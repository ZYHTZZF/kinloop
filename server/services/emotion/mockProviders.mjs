import { EMOTION_ERROR_CODES, EmotionProviderError } from './errors.mjs'

const positiveWords = ['开心', '高兴', '很好', '棒', '喜欢', 'smile', 'happy']
const negativeWords = ['难受', '伤心', '生气', '烦', '痛', 'angry', 'sad']
const anxiousWords = ['担心', '焦虑', '紧张', '着急']
const calmWords = ['平静', '还好', '正常', 'calm']

function containsAny(text, words) {
  return words.some((word) => text.includes(word))
}

function inferFromText(textValue) {
  const text = (textValue ?? '').toLowerCase()

  if (!text.trim()) {
    return { label: 'neutral', score: 0.35 }
  }
  if (containsAny(text, anxiousWords)) {
    return { label: 'anxious', score: 0.78 }
  }
  if (containsAny(text, negativeWords)) {
    return { label: 'negative', score: 0.82 }
  }
  if (containsAny(text, calmWords)) {
    return { label: 'calm', score: 0.66 }
  }
  if (containsAny(text, positiveWords)) {
    return { label: 'positive', score: 0.8 }
  }
  return { label: 'neutral', score: 0.55 }
}

export function mockTextEmotion(input) {
  return {
    ...inferFromText(input.text),
    raw: { mode: 'mock', provider: 'text' },
  }
}

export function mockFaceEmotion(input) {
  const hint = `${input.imageUrl ?? ''}`.toLowerCase()

  if (!hint.trim()) {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.INVALID_INPUT, 'Missing imageUrl for face emotion')
  }
  if (hint.includes('noface')) {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.NO_FACE, 'No face detected in image')
  }
  if (hint.includes('multiface')) {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.MULTI_FACE, 'Multiple faces detected in image')
  }

  const prediction = inferFromText(hint)
  return {
    ...prediction,
    raw: { mode: 'mock', provider: 'face' },
  }
}

export function mockVoiceToneEmotion(input) {
  const hint = `${input.audioUrl ?? ''} ${input.transcript ?? ''}`.toLowerCase()

  if (!hint.trim()) {
    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.INVALID_INPUT,
      'Missing audioUrl/transcript for voice tone emotion',
    )
  }

  const prediction = inferFromText(hint)
  return {
    ...prediction,
    raw: { mode: 'mock', provider: 'voice_tone' },
  }
}

