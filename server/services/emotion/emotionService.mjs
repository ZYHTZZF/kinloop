import { createPulse } from '../../repositories/pulseRepository.mjs'
import { detectFaceEmotion } from './adapters/faceAdapter.mjs'
import { detectTextEmotion } from './adapters/textAdapter.mjs'
import { detectVoiceToneEmotion } from './adapters/voiceToneAdapter.mjs'
import { buildSummary, withRetry } from './common.mjs'
import { EmotionProviderError } from './errors.mjs'

const DEFAULT_TIMEOUT_MS = 3000

function toProviderOptions(source) {
  const sourceKey = source.toUpperCase()
  return {
    provider: process.env[`KINLOOP_EMOTION_${sourceKey}_PROVIDER`] ?? null,
    endpoint: process.env[`KINLOOP_EMOTION_${sourceKey}_ENDPOINT`] ?? null,
    apiKey: process.env[`KINLOOP_EMOTION_${sourceKey}_API_KEY`] ?? null,
    secretKey: process.env[`KINLOOP_EMOTION_${sourceKey}_SECRET_KEY`] ?? null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
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
    status: 'OPEN',
  }
}

function toFailureResult(source, error) {
  const label = 'neutral'
  const summary = buildSummary(source, `fallback:${label}`)
  return {
    source,
    label,
    score: 0.2,
    severity: 'LOW',
    summary,
    raw: {
      mode: 'fallback',
      code: error?.code ?? 'UNKNOWN',
      message: error?.message ?? 'unknown error',
    },
  }
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
      results.push(toFailureResult('text', error))
    }
  }

  if (shouldRunFace) {
    try {
      const result = await runAdapter(detectFaceEmotion, input, toProviderOptions('face'))
      results.push(result)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      results.push(toFailureResult('face', error))
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
          results.push(toFailureResult('text_fallback', fallbackError))
        }
      } else {
        errors.push(error instanceof Error ? error.message : String(error))
        results.push(toFailureResult('voice_tone', error))
      }
    }
  }

  for (const result of results) {
    const pulse = createPulse(
      toPulsePayload({
        familySpaceId: payload.familySpaceId,
        conversationId: payload.conversationId,
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
