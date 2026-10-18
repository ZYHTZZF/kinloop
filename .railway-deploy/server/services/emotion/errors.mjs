export const EMOTION_ERROR_CODES = {
  TIMEOUT: 'EMOTION_PROVIDER_TIMEOUT',
  UNAVAILABLE: 'EMOTION_PROVIDER_UNAVAILABLE',
  INVALID_INPUT: 'EMOTION_INVALID_INPUT',
  NO_FACE: 'EMOTION_NO_FACE_DETECTED',
  MULTI_FACE: 'EMOTION_MULTI_FACE_AMBIGUOUS',
}

export class EmotionProviderError extends Error {
  constructor(code, message, details = null) {
    super(message)
    this.name = 'EmotionProviderError'
    this.code = code
    this.details = details
  }
}

