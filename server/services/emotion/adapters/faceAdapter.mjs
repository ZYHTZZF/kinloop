import { buildEmotionResult, callHttpProvider } from '../common.mjs'
import { EMOTION_ERROR_CODES, EmotionProviderError } from '../errors.mjs'
import { mockFaceEmotion } from '../mockProviders.mjs'
import { analyzeBaiduFaceEmotion } from '../providerClients.mjs'

function validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.INVALID_INPUT, 'Invalid emotion input payload')
  }
  if (!input.imageUrl || typeof input.imageUrl !== 'string') {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.INVALID_INPUT, 'Missing imageUrl for face emotion')
  }
}

export async function detectFaceEmotion(input, options = {}) {
  validateInput(input)

  const provider = options.provider ?? 'baidu'
  let providerResult = null

  if (provider === 'baidu') {
    providerResult = await analyzeBaiduFaceEmotion({
      imageUrl: input.imageUrl,
      apiKey: options.apiKey,
      secretKey: options.secretKey,
      timeoutMs: options.timeoutMs,
    })
  } else {
    providerResult = await callHttpProvider({
      endpoint: options.endpoint,
      apiKey: options.apiKey,
      timeoutMs: options.timeoutMs,
      payload: { imageUrl: input.imageUrl, conversationId: input.conversationId },
    })
  }

  const resolved = providerResult ?? mockFaceEmotion(input)
  return buildEmotionResult({
    source: 'face',
    label: resolved.label,
    score: resolved.score,
    raw: resolved.raw,
  })
}
