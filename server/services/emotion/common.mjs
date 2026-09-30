import { EMOTION_ERROR_CODES, EmotionProviderError } from './errors.mjs'

const LOW_THRESHOLD = 0.5
const MEDIUM_THRESHOLD = 0.75

export function normalizeScore(value) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

export function toSeverity(score) {
  const normalized = normalizeScore(score)
  if (normalized < LOW_THRESHOLD) return 'LOW'
  if (normalized < MEDIUM_THRESHOLD) return 'MEDIUM'
  return 'HIGH'
}

export function buildSummary(source, label) {
  const prefix = {
    text: '文本情绪识别',
    face: '表情识别',
    voice_tone: '语气识别',
    text_fallback: '语气识别降级(文本)',
  }[source] ?? '情绪识别'

  return `${prefix}：${toLabelText(label)}`
}

function toLabelText(label) {
  return {
    positive: '积极',
    neutral: '平稳',
    negative: '消极',
    anxious: '焦虑',
    sad: '难过',
    angry: '生气',
    calm: '平静',
  }[label] ?? `${label ?? '未知'}`
}

export async function withRetry(task, options = {}) {
  const maxAttempts = options.maxAttempts ?? 2
  const baseDelayMs = options.baseDelayMs ?? 250
  let lastError

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) {
        throw error
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

function parseProviderResponse(data) {
  const label = typeof data?.label === 'string' ? data.label : 'neutral'
  const score = normalizeScore(typeof data?.score === 'number' ? data.score : 0.3)
  return { label, score, raw: data }
}

export async function fetchJson(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 3000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new EmotionProviderError(
        EMOTION_ERROR_CODES.UNAVAILABLE,
        `Emotion provider request failed: ${response.status}`,
      )
    }

    return response.json()
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new EmotionProviderError(EMOTION_ERROR_CODES.TIMEOUT, 'Emotion provider timeout')
    }
    if (error instanceof EmotionProviderError) {
      throw error
    }

    throw new EmotionProviderError(EMOTION_ERROR_CODES.UNAVAILABLE, 'Emotion provider unavailable', {
      cause: error?.message ?? String(error),
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function callHttpProvider(options) {
  const endpoint = options.endpoint
  const apiKey = options.apiKey
  const timeoutMs = options.timeoutMs ?? 3000
  const payload = options.payload ?? {}
  const headers = options.headers ?? {}

  if (!endpoint || !apiKey) {
    return null
  }

  const data = await fetchJson(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    body: JSON.stringify(payload),
    timeoutMs,
  })

  return parseProviderResponse(data)
}

export function buildEmotionResult({ source, label, score, raw }) {
  const normalized = normalizeScore(score)
  return {
    source,
    label,
    score: normalized,
    severity: toSeverity(normalized),
    summary: buildSummary(source, label),
    raw,
  }
}
