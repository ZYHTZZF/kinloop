import { EMOTION_ERROR_CODES, EmotionProviderError } from './errors.mjs'

const positiveWords = [
  '开心',
  '高兴',
  '很棒',
  '真好',
  '喜欢',
  '满意',
  '幸福',
  'happy',
  'smile',
]

const negativeWords = [
  '难受',
  '伤心',
  '失望',
  '生气',
  '气死',
  '气炸',
  '烦死',
  '委屈',
  '难过',
  '压秤',
  '被骗',
  '不舒服',
  '不吃饭',
  '愤怒',
  '讨厌',
  'angry',
  'sad',
]

const anxiousWords = [
  '担心',
  '焦虑',
  '紧张',
  '害怕',
  '不安',
  '慌',
  '睡不着',
  'worry',
  'anxious',
]

const calmWords = [
  '平静',
  '还好',
  '没事',
  '正常',
  '放心',
  'calm',
]

function containsAny(text, words) {
  return words.some((word) => text.includes(word))
}

function inferFromText(textValue) {
  const text = `${textValue ?? ''}`.trim().toLowerCase()

  if (!text) {
    return { label: 'neutral', score: 0.35 }
  }

  if (containsAny(text, anxiousWords)) {
    return { label: 'anxious', score: 0.8 }
  }

  if (containsAny(text, negativeWords)) {
    if (text.includes('气死') || text.includes('气炸') || text.includes('愤怒')) {
      return { label: 'angry', score: 0.92 }
    }

    if (text.includes('伤心') || text.includes('难过') || text.includes('委屈')) {
      return { label: 'sad', score: 0.86 }
    }

    return { label: 'negative', score: 0.84 }
  }

  if (containsAny(text, calmWords)) {
    return { label: 'calm', score: 0.66 }
  }

  if (containsAny(text, positiveWords)) {
    return { label: 'positive', score: 0.82 }
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
