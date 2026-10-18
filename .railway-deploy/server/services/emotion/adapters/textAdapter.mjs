import { buildEmotionResult, callHttpProvider } from '../common.mjs'
import { EMOTION_ERROR_CODES, EmotionProviderError } from '../errors.mjs'
import { mockTextEmotion } from '../mockProviders.mjs'
import { analyzeBaiduTextEmotion, analyzeLlmTextEmotion } from '../providerClients.mjs'

function validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.INVALID_INPUT, 'Invalid emotion input payload')
  }
  if (!input.text || typeof input.text !== 'string') {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.INVALID_INPUT, 'Missing text for text emotion')
  }
}

export async function detectTextEmotion(input, options = {}) {
  validateInput(input)

  const provider = options.provider ?? 'baidu'
  let providerResult = null

  if (provider === 'llm') {
    providerResult = await analyzeLlmTextEmotion({
      text: input.text,
      timeoutMs: options.timeoutMs,
    })
  } else if (provider === 'baidu') {
    providerResult = await analyzeBaiduTextEmotion({
      text: input.text,
      apiKey: options.apiKey,
      secretKey: options.secretKey,
      timeoutMs: options.timeoutMs,
    })
  } else {
    providerResult = await callHttpProvider({
      endpoint: options.endpoint,
      apiKey: options.apiKey,
      timeoutMs: options.timeoutMs,
      payload: { text: input.text, conversationId: input.conversationId },
    })
  }

  const resolved = providerResult ?? mockTextEmotion(input)
  return buildEmotionResult({
    source: 'text',
    label: resolved.label,
    score: resolved.score,
    raw: resolved.raw,
  })
}
