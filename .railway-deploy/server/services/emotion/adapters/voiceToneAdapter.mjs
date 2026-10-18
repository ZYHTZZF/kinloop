import { buildEmotionResult, callHttpProvider } from '../common.mjs'
import { EMOTION_ERROR_CODES, EmotionProviderError } from '../errors.mjs'
import { mockVoiceToneEmotion } from '../mockProviders.mjs'
import { analyzeHumeVoiceTone } from '../providerClients.mjs'

function validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.INVALID_INPUT, 'Invalid emotion input payload')
  }
  if (!input.audioUrl && !input.transcript) {
    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.INVALID_INPUT,
      'Missing audioUrl/transcript for voice tone emotion',
    )
  }
}

export async function detectVoiceToneEmotion(input, options = {}) {
  validateInput(input)

  const provider = options.provider ?? 'hume'
  let providerResult = null

  if (provider === 'hume') {
    providerResult = await analyzeHumeVoiceTone({
      audioUrl: input.audioUrl ?? null,
      apiKey: options.apiKey,
      secretKey: options.secretKey,
      timeoutMs: options.timeoutMs,
    })
  } else {
    providerResult = await callHttpProvider({
      endpoint: options.endpoint,
      apiKey: options.apiKey,
      timeoutMs: options.timeoutMs,
      payload: {
        audioUrl: input.audioUrl ?? null,
        transcript: input.transcript ?? null,
        conversationId: input.conversationId,
      },
    })
  }

  const resolved = providerResult ?? mockVoiceToneEmotion(input)
  return buildEmotionResult({
    source: 'voice_tone',
    label: resolved.label,
    score: resolved.score,
    raw: resolved.raw,
  })
}
