import { createPulse } from '../../repositories/pulseRepository.mjs'
import { detectFaceEmotion } from './adapters/faceAdapter.mjs'
import { detectTextEmotion } from './adapters/textAdapter.mjs'
import { detectVoiceToneEmotion } from './adapters/voiceToneAdapter.mjs'
import { buildSummary, withRetry } from './common.mjs'
import { EmotionProviderError } from './errors.mjs'
import { mockFaceEmotion, mockTextEmotion, mockVoiceToneEmotion } from './mockProviders.mjs'

const DEFAULT_TIMEOUT_MS = Number(process.env.KINLOOP_EMOTION_TIMEOUT_MS ?? 12000)

function toProviderOptions(source) {
  const sourceKey = source.toUpperCase()
  const sourceTimeout = Number(process.env[`KINLOOP_EMOTION_${sourceKey}_TIMEOUT_MS`] ?? DEFAULT_TIMEOUT_MS)
  const fallbackProvider = source === 'voice_tone' && process.env.HUME_API_KEY ? 'hume' : null
  const fallbackApiKey = source === 'voice_tone' ? process.env.HUME_API_KEY ?? null : null
  const fallbackSecretKey = source === 'voice_tone' ? process.env.HUME_SECRET_KEY ?? null : null
  return {
    provider: process.env[`KINLOOP_EMOTION_${sourceKey}_PROVIDER`] ?? fallbackProvider,
    endpoint: process.env[`KINLOOP_EMOTION_${sourceKey}_ENDPOINT`] ?? null,
    apiKey: process.env[`KINLOOP_EMOTION_${sourceKey}_API_KEY`] ?? fallbackApiKey,
    secretKey: process.env[`KINLOOP_EMOTION_${sourceKey}_SECRET_KEY`] ?? fallbackSecretKey,
    timeoutMs: Number.isFinite(sourceTimeout) ? sourceTimeout : DEFAULT_TIMEOUT_MS,
  }
}

function toPulsePayload(params) {
  return {
    familySpaceId: params.familySpaceId,
    sourceType: 'AI',
    pulseType: 'Emotion',
    severity: params.result.severity,
    summary: params.result.summary,
    sourceConversationId: params.conversationId,
    sourceMessageId: params.sourceMessageId ?? null,
    sourceExcerpt: buildPulseExcerpt(params.result.source, params.input),
    emotionSource: params.result.source,
    emotionLabel: params.result.label,
    emotionMode: params.result.raw?.mode ?? null,
    status: 'OPEN',
  }
}

function buildPulseExcerpt(source, input) {
  const rawValue =
    source === 'voice_tone'
      ? input.transcript ?? input.text
      : source === 'text_fallback'
        ? input.transcript ?? input.text
        : source === 'text'
          ? input.text
          : null

  if (!rawValue || typeof rawValue !== 'string') {
    return null
  }

  const normalized = rawValue.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return null
  }

  return normalized.length > 60 ? `${normalized.slice(0, 60)}...` : normalized
}

function toFailureResult(source, error, fallbackResult = null) {
  const label = fallbackResult?.label ?? 'neutral'
  const score = Number.isFinite(fallbackResult?.score) ? fallbackResult.score : 0.2
  const severity = score < 0.5 ? 'LOW' : score < 0.75 ? 'MEDIUM' : 'HIGH'
  return {
    source,
    label,
    score,
    severity,
    summary: buildSummary(source, label),
    raw: {
      mode: 'fallback',
      code: error?.code ?? 'UNKNOWN',
      message: error?.message ?? 'unknown error',
      providerRaw: fallbackResult?.raw ?? null,
    },
  }
}

function buildLocalFallback(source, input) {
  if (source === 'text' || source === 'text_fallback') {
    const text = input.text ?? input.transcript ?? ''
    return mockTextEmotion({ text })
  }

  if (source === 'voice_tone') {
    return mockVoiceToneEmotion(input)
  }

  if (source === 'face') {
    return mockFaceEmotion(input)
  }

  return null
}

async function runAdapter(adapter, input, providerOptions) {
  return withRetry(() => adapter(input, providerOptions), {
    maxAttempts: 2,
    baseDelayMs: 250,
  })
}

export async function analyzeEmotionsAndCreatePulses(payload) {
  const input = {
    conversationId: payload.conversationId,
    text: payload.text ?? null,
    imageUrl: payload.imageUrl ?? null,
    audioUrl: payload.audioUrl ?? null,
    transcript: payload.transcript ?? null,
  }

  const results = []
  const errors = []
  const createdPulses = []
  const shouldRunText = Boolean(input.text?.trim())
  const shouldRunFace = Boolean(input.imageUrl?.trim())
  const shouldRunVoice = Boolean(input.audioUrl?.trim() || input.transcript?.trim())

  if (shouldRunText) {
    try {
      const result = await runAdapter(detectTextEmotion, input, toProviderOptions('text'))
      results.push(result)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      results.push(toFailureResult('text', error, buildLocalFallback('text', input)))
    }
  }

  if (shouldRunFace) {
    try {
      const result = await runAdapter(detectFaceEmotion, input, toProviderOptions('face'))
      results.push(result)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      results.push(toFailureResult('face', error, buildLocalFallback('face', input)))
    }
  }

  if (shouldRunVoice) {
    try {
      const result = await runAdapter(detectVoiceToneEmotion, input, toProviderOptions('voice_tone'))
      results.push(result)
    } catch (error) {
      const fallbackText = input.transcript ?? input.text
      if (fallbackText?.trim()) {
        try {
          const fallbackResult = await runAdapter(
            detectTextEmotion,
            { ...input, text: fallbackText },
            toProviderOptions('text'),
          )
          results.push({
            ...fallbackResult,
            source: 'text_fallback',
            summary: buildSummary('text_fallback', fallbackResult.label),
          })
        } catch (fallbackError) {
          errors.push(
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          )
          results.push(
            toFailureResult(
              'text_fallback',
              fallbackError,
              buildLocalFallback('text_fallback', { ...input, text: fallbackText }),
            ),
          )
        }
      } else {
        errors.push(error instanceof Error ? error.message : String(error))
        results.push(toFailureResult('voice_tone', error, buildLocalFallback('voice_tone', input)))
      }
    }
  }

  for (const result of results) {
    const pulse = createPulse(
      toPulsePayload({
        familySpaceId: payload.familySpaceId,
        conversationId: payload.conversationId,
        sourceMessageId: payload.sourceMessageId,
        input,
        result,
      }),
    )
    createdPulses.push(pulse)
  }

  const normalizedErrors = errors.map((message) => ({
    code: message.includes('timeout') ? 'EMOTION_PROVIDER_TIMEOUT' : 'EMOTION_PROVIDER_UNAVAILABLE',
    message,
  }))

  return {
    input,
    results,
    createdPulses,
    errors: normalizedErrors,
  }
}

export function isEmotionRequestValid(payload) {
  if (!payload || typeof payload !== 'object') return false
  if (!payload.conversationId || !payload.familySpaceId) return false
  return Boolean(payload.text || payload.imageUrl || payload.audioUrl || payload.transcript)
}

export function normalizeEmotionRequest(payload, fallbackFamilySpaceId) {
  return {
    conversationId: payload.conversationId,
    familySpaceId: payload.familySpaceId ?? fallbackFamilySpaceId,
    sourceMessageId: payload.sourceMessageId ?? null,
    text: payload.text ?? null,
    imageUrl: payload.imageUrl ?? null,
    audioUrl: payload.audioUrl ?? null,
    transcript: payload.transcript ?? null,
  }
}

export function toErrorResponse(error) {
  if (error instanceof EmotionProviderError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details ?? null,
    }
  }
  return {
    code: 'EMOTION_PROVIDER_UNAVAILABLE',
    message: error instanceof Error ? error.message : String(error),
  }
}
