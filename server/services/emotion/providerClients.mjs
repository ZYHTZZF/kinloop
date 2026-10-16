import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } from '../../config.mjs'
import { fetchJson, normalizeScore } from './common.mjs'
import { EMOTION_ERROR_CODES, EmotionProviderError } from './errors.mjs'

const baiduTokenCache = new Map()
const DEFAULT_HUME_TRANSCRIPTION_LANGUAGE = process.env.HUME_TRANSCRIPTION_LANGUAGE ?? 'zh'
const LLM_TEXT_EMOTION_TIMEOUT_MS = Number(process.env.KINLOOP_LLM_TEXT_EMOTION_TIMEOUT_MS ?? 15000)

function mapBaiduEmotionLabel(value) {
  const normalized = `${value ?? ''}`.toLowerCase()
  if (normalized.includes('optimistic') || normalized.includes('positive')) return 'positive'
  if (normalized.includes('pessimistic') || normalized.includes('negative')) return 'negative'
  if (normalized.includes('neutral')) return 'neutral'
  if (normalized.includes('anxious') || normalized.includes('worry')) return 'anxious'
  if (normalized.includes('angry')) return 'angry'
  if (normalized.includes('sad')) return 'sad'
  if (normalized.includes('calm')) return 'calm'
  return 'neutral'
}

function parseBaiduConversationEmotionItem(item) {
  if (!item || typeof item !== 'object') {
    return { label: 'neutral', score: 0.35 }
  }

  const labelFromField =
    item.label ??
    item.emotion ??
    item.sentiment

  const scoreCandidates = [
    item.prob,
    item.confidence,
    item.score,
    item.positive_prob,
    item.negative_prob,
    item.neutral_prob,
    item.optimistic_prob,
    item.pessimistic_prob,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

  const score = scoreCandidates.length > 0 ? Math.max(...scoreCandidates) : 0.55
  return {
    label: mapBaiduEmotionLabel(labelFromField),
    score: normalizeScore(score),
  }
}

function parseBaiduConversationEmotion(data) {
  const candidates = [
    ...(Array.isArray(data?.items) ? data.items : []),
    ...(Array.isArray(data?.results) ? data.results : []),
    ...(Array.isArray(data?.result?.items) ? data.result.items : []),
  ].filter((item) => item && typeof item === 'object')

  if (candidates.length === 0) {
    return null
  }

  const parsedCandidates = candidates.map((item) => parseBaiduConversationEmotionItem(item))
  return parsedCandidates.sort((left, right) => right.score - left.score)[0] ?? null
}

function isSuspiciousBaiduTextEcho(originalText, echoedText) {
  const source = `${originalText ?? ''}`.trim()
  const echoed = `${echoedText ?? ''}`.trim()

  if (!source || !echoed) {
    return false
  }

  return /^\?+$/.test(echoed)
}

function mapBaiduFaceEmotion(type) {
  const normalized = `${type ?? ''}`.toLowerCase()
  if (normalized.includes('happy')) return 'positive'
  if (normalized.includes('angry')) return 'angry'
  if (normalized.includes('sad')) return 'sad'
  if (normalized.includes('fear')) return 'anxious'
  if (normalized.includes('neutral')) return 'neutral'
  if (normalized.includes('surprise')) return 'anxious'
  if (normalized.includes('disgust')) return 'negative'
  if (normalized.includes('calm')) return 'calm'
  return 'neutral'
}

function extractJsonObjectFromContent(content) {
  if (typeof content !== 'string') {
    return {}
  }

  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) {
      return {}
    }

    try {
      return JSON.parse(match[0])
    } catch {
      return {}
    }
  }
}

function normalizeLlmEmotionLabel(value) {
  const normalized = `${value ?? ''}`.trim().toLowerCase()

  if (['positive', 'neutral', 'negative', 'anxious', 'sad', 'angry', 'calm'].includes(normalized)) {
    return normalized
  }

  if (normalized.includes('joy') || normalized.includes('happy') || normalized.includes('积极')) return 'positive'
  if (normalized.includes('平静') || normalized.includes('calm')) return 'calm'
  if (normalized.includes('焦虑') || normalized.includes('worry') || normalized.includes('anx')) return 'anxious'
  if (normalized.includes('生气') || normalized.includes('愤怒') || normalized.includes('angry')) return 'angry'
  if (normalized.includes('难过') || normalized.includes('悲伤') || normalized.includes('sad')) return 'sad'
  if (normalized.includes('消极') || normalized.includes('负面') || normalized.includes('negative')) return 'negative'
  return 'neutral'
}

export async function analyzeLlmTextEmotion({
  text,
  timeoutMs = LLM_TEXT_EMOTION_TIMEOUT_MS,
}) {
  if (!LLM_API_KEY || !LLM_MODEL) {
    return null
  }

  const systemPrompt = [
    '你是一个中文文本情绪识别器。',
    '请判断说话者此刻最主要的情绪。',
    '可选标签只能是：positive, neutral, negative, anxious, sad, angry, calm。',
    '请特别注意中文里隐含的低落、无望、委屈、烦躁、丧气、绝望，不要因为语气平静就误判为 neutral。',
    '只返回严格 JSON，不要输出解释文字。',
    '格式：{"label":"sad","score":0.88,"reason":"一句极短中文理由"}',
  ].join('')

  const payloadBase = {
    model: LLM_MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `文本：${text}` },
    ],
  }

  let response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      ...payloadBase,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok && response.status === 400) {
    const rawText = await response.text()
    if (/response_format|json_object/i.test(rawText)) {
      response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify(payloadBase),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } else {
      throw new EmotionProviderError(
        EMOTION_ERROR_CODES.UNAVAILABLE,
        `LLM text emotion failed: ${rawText}`,
      )
    }
  }

  if (!response.ok) {
    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.UNAVAILABLE,
      `LLM text emotion failed: ${response.status}`,
    )
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  const parsed = extractJsonObjectFromContent(content)
  const label = normalizeLlmEmotionLabel(parsed?.label)
  const score = normalizeScore(Number(parsed?.score))

  return {
    label,
    score: score || 0.7,
    raw: {
      provider: 'llm',
      reason: typeof parsed?.reason === 'string' ? parsed.reason : null,
      completion: data,
    },
  }
}

export async function getBaiduAccessToken({ apiKey, secretKey, timeoutMs = 3000 }) {
  if (!apiKey || !secretKey) {
    return null
  }

  const cacheKey = `${apiKey}:${secretKey}`
  const cached = baiduTokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token
  }

  const tokenUrl = new URL('https://aip.baidubce.com/oauth/2.0/token')
  tokenUrl.searchParams.set('grant_type', 'client_credentials')
  tokenUrl.searchParams.set('client_id', apiKey)
  tokenUrl.searchParams.set('client_secret', secretKey)

  const data = await fetchJson(tokenUrl.toString(), {
    method: 'POST',
    timeoutMs,
  })

  if (!data?.access_token) {
    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.UNAVAILABLE,
      'Baidu token response missing access_token',
    )
  }

  const expiresAt = Date.now() + Number(data.expires_in ?? 0) * 1000
  baiduTokenCache.set(cacheKey, { token: data.access_token, expiresAt })
  return data.access_token
}

export async function analyzeBaiduTextEmotion({
  text,
  apiKey,
  secretKey,
  timeoutMs = 3000,
}) {
  const accessToken = await getBaiduAccessToken({ apiKey, secretKey, timeoutMs })
  if (!accessToken) return null

  const endpoint = new URL('https://aip.baidubce.com/rpc/2.0/nlp/v1/emotion')
  endpoint.searchParams.set('access_token', accessToken)

  const data = await fetchJson(endpoint.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
    timeoutMs,
  })

  if (data?.error_code) {
    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.UNAVAILABLE,
      `Baidu conversation emotion failed: ${data.error_code}`,
      data,
    )
  }

  if (isSuspiciousBaiduTextEcho(text, data?.text)) {
    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.UNAVAILABLE,
      'Baidu conversation emotion returned garbled text echo',
      data,
    )
  }

  const parsed = parseBaiduConversationEmotion(data)
  if (!parsed) {
    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.UNAVAILABLE,
      'Baidu conversation emotion response missing items',
      data,
    )
  }

  return {
    label: parsed.label,
    score: parsed.score,
    raw: data,
  }
}

export async function analyzeBaiduFaceEmotion({
  imageUrl,
  apiKey,
  secretKey,
  timeoutMs = 3000,
}) {
  const accessToken = await getBaiduAccessToken({ apiKey, secretKey, timeoutMs })
  if (!accessToken) return null

  const endpoint = new URL('https://aip.baidubce.com/rest/2.0/face/v3/detect')
  endpoint.searchParams.set('access_token', accessToken)

  const data = await fetchJson(endpoint.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageUrl,
      image_type: 'URL',
      face_field: 'emotion',
      max_face_num: 2,
    }),
    timeoutMs,
  })

  if (data?.error_code) {
    if (`${data.error_msg ?? ''}`.toLowerCase().includes('face')) {
      throw new EmotionProviderError(EMOTION_ERROR_CODES.NO_FACE, 'No face detected', data)
    }
    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.UNAVAILABLE,
      `Baidu face detect failed: ${data.error_code}`,
      data,
    )
  }

  const faceNum = Number(data?.result?.face_num ?? 0)
  const faceList = Array.isArray(data?.result?.face_list) ? data.result.face_list : []
  if (faceNum <= 0 || faceList.length === 0) {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.NO_FACE, 'No face detected', data)
  }
  if (faceNum > 1) {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.MULTI_FACE, 'Multiple faces detected', data)
  }

  const emotion = faceList[0]?.emotion
  return {
    label: mapBaiduFaceEmotion(emotion?.type),
    score: normalizeScore(Number(emotion?.probability ?? 0)),
    raw: data,
  }
}

function extractHumeProsodyPrediction(data) {
  const root = Array.isArray(data) ? data[0] : data
  const predictions = root?.results?.predictions
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return null
  }

  const grouped = predictions[0]?.models?.prosody?.grouped_predictions?.[0]
  const segments = Array.isArray(grouped?.predictions) ? grouped.predictions : []
  const emotions = Array.isArray(segments[0]?.emotions) ? segments[0].emotions : []
  if (emotions.length === 0) {
    return null
  }

  const sorted = [...emotions].sort((a, b) => Number(b?.score ?? 0) - Number(a?.score ?? 0))
  const top = sorted[0]
  const rawLabel = `${top?.name ?? 'neutral'}`.toLowerCase()

  let label = 'neutral'
  if (rawLabel.includes('joy') || rawLabel.includes('happy')) label = 'positive'
  else if (rawLabel.includes('sad')) label = 'sad'
  else if (rawLabel.includes('anger')) label = 'angry'
  else if (rawLabel.includes('anx')) label = 'anxious'
  else if (rawLabel.includes('calm')) label = 'calm'
  else if (rawLabel.includes('neutral')) label = 'neutral'
  else if (rawLabel.includes('distress') || rawLabel.includes('fear')) label = 'negative'

  return {
    label,
    score: normalizeScore(Number(top?.score ?? 0)),
    raw: data,
  }
}

export async function analyzeHumeVoiceTone({
  audioUrl,
  apiKey,
  timeoutMs = 3000,
}) {
  if (!apiKey || !audioUrl) {
    return null
  }

  if (audioUrl.startsWith('data:')) {
    const file = dataUrlToFile(audioUrl)
    const formData = new FormData()
    formData.append('json', JSON.stringify({
      models: {
        prosody: {},
      },
      transcription: {
        language: DEFAULT_HUME_TRANSCRIPTION_LANGUAGE,
      },
    }))
    formData.append('file', file, file.name)

    const jobData = await fetchWithTimeout('https://api.hume.ai/v0/batch/jobs', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': apiKey,
      },
      body: formData,
      timeoutMs,
    })

    const jobId = jobData?.job_id
    if (!jobId) {
      throw new EmotionProviderError(EMOTION_ERROR_CODES.UNAVAILABLE, 'Hume job_id missing', jobData)
    }

    return pollHumeJob({ jobId, apiKey, timeoutMs })
  }

  const jobData = await fetchJson('https://api.hume.ai/v0/batch/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hume-Api-Key': apiKey,
    },
    body: JSON.stringify({
      models: {
        prosody: {},
      },
      transcription: {
        language: DEFAULT_HUME_TRANSCRIPTION_LANGUAGE,
      },
      urls: [audioUrl],
    }),
    timeoutMs,
  })

  const jobId = jobData?.job_id
  if (!jobId) {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.UNAVAILABLE, 'Hume job_id missing', jobData)
  }

  return pollHumeJob({ jobId, apiKey, timeoutMs })
}

async function pollHumeJob({ jobId, apiKey, timeoutMs = 3000 }) {
  const maxPollCount = 45
  for (let index = 0; index < maxPollCount; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const statusData = await fetchJson(
      `https://api.hume.ai/v0/batch/jobs/${jobId}`,
      buildHumeAuthRequest({ apiKey, timeoutMs }),
    )

    const status = `${statusData?.state?.status ?? statusData?.state ?? ''}`.toUpperCase()
    if (status === 'FAILED') {
      throw new EmotionProviderError(
        EMOTION_ERROR_CODES.UNAVAILABLE,
        'Hume job failed',
        statusData,
      )
    }

    if (status === 'COMPLETED') {
      const predictions = await fetchJson(
        `https://api.hume.ai/v0/batch/jobs/${jobId}/predictions`,
        buildHumeAuthRequest({ apiKey, timeoutMs }),
      )

      const parsed = extractHumeProsodyPrediction(predictions)
      if (!parsed) {
        throw new EmotionProviderError(
          EMOTION_ERROR_CODES.UNAVAILABLE,
          'Hume predictions missing prosody data',
          predictions,
        )
      }
      return parsed
    }
  }

  throw new EmotionProviderError(EMOTION_ERROR_CODES.TIMEOUT, 'Hume prediction polling timeout')
}
function buildHumeAuthRequest({ apiKey, timeoutMs }) {
  return {
    headers: { 'X-Hume-Api-Key': apiKey },
    timeoutMs,
  }
}

async function fetchWithTimeout(url, options = {}) {
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
        `Hume request failed: ${response.status}`,
      )
    }

    return response.json()
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new EmotionProviderError(EMOTION_ERROR_CODES.TIMEOUT, 'Hume request timeout')
    }
    if (error instanceof EmotionProviderError) {
      throw error
    }

    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.UNAVAILABLE,
      'Hume request unavailable',
      { cause: error instanceof Error ? error.message : String(error) },
    )
  } finally {
    clearTimeout(timer)
  }
}

function dataUrlToFile(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+)(?:;[^;,=]+=[^;,]+)*;base64,(.+)$/)
  if (!match) {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.INVALID_INPUT, 'Invalid audio data URL')
  }

  const mimeType = match[1] || 'audio/webm'
  const base64Payload = match[2]
  const inputBuffer = Buffer.from(base64Payload, 'base64')
  const buffer = mimeType.includes('wav') ? preprocessWavBuffer(inputBuffer) : inputBuffer
  const extension = mimeTypeToExtension(mimeType)
  const blob = new Blob([buffer], { type: mimeType })
  return new File([blob], `voice-tone-input.${extension}`, { type: mimeType })
}

function mimeTypeToExtension(mimeType) {
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'mp4'
  return 'webm'
}

function preprocessWavBuffer(buffer) {
  if (buffer.length < 44) {
    return buffer
  }

  const bytesPerSample = buffer.readUInt16LE(34) / 8
  const channelCount = buffer.readUInt16LE(22)
  const sampleRate = buffer.readUInt32LE(24)
  const dataSize = buffer.readUInt32LE(40)
  const dataOffset = 44

  if (bytesPerSample !== 2 || channelCount !== 1 || dataOffset + dataSize > buffer.length) {
    return buffer
  }

  const sampleCount = dataSize / bytesPerSample
  const samples = new Float32Array(sampleCount)
  let peak = 0

  for (let index = 0; index < sampleCount; index += 1) {
    const value = buffer.readInt16LE(dataOffset + index * bytesPerSample) / 32768
    samples[index] = value
    peak = Math.max(peak, Math.abs(value))
  }

  if (peak < 0.005) {
    return buffer
  }

  const silenceThreshold = Math.min(0.02, Math.max(0.006, peak * 0.08))
  let start = 0
  while (start < samples.length && Math.abs(samples[start]) < silenceThreshold) {
    start += 1
  }

  let end = samples.length - 1
  while (end > start && Math.abs(samples[end]) < silenceThreshold) {
    end -= 1
  }

  const padding = Math.floor(sampleRate * 0.12)
  start = Math.max(0, start - padding)
  end = Math.min(samples.length - 1, end + padding)

  const trimmed = samples.slice(start, end + 1)
  const targetPeak = 0.92
  const gain = Math.min(6, targetPeak / peak)

  for (let index = 0; index < trimmed.length; index += 1) {
    const value = trimmed[index] * gain
    trimmed[index] = Math.max(-1, Math.min(1, value))
  }

  return encodeMono16BitWav(trimmed, sampleRate)
}

function encodeMono16BitWav(samples, sampleRate) {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const dataSize = samples.length * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8, 'ascii')
  buffer.write('fmt ', 12, 'ascii')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * blockAlign, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'ascii')
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    const int16 = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff)
    buffer.writeInt16LE(int16, 44 + index * bytesPerSample)
  }

  return buffer
}
