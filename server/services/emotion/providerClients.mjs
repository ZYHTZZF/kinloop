import { fetchJson, normalizeScore } from './common.mjs'
import { EMOTION_ERROR_CODES, EmotionProviderError } from './errors.mjs'

const baiduTokenCache = new Map()

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

  const item = data?.items?.[0] ?? data?.results?.[0] ?? data?.result?.items?.[0]
  if (!item) {
    throw new EmotionProviderError(
      EMOTION_ERROR_CODES.UNAVAILABLE,
      'Baidu conversation emotion response missing items',
      data,
    )
  }

  const parsed = parseBaiduConversationEmotionItem(item)

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
  const results = data?.results
  if (!Array.isArray(results) || results.length === 0) {
    return null
  }

  const prediction = results[0]?.predictions?.[0]
  const grouped = prediction?.models?.prosody?.grouped_predictions?.[0]
  const emotions = Array.isArray(grouped?.predictions) ? grouped.predictions : []
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
      urls: [audioUrl],
    }),
    timeoutMs,
  })

  const jobId = jobData?.job_id
  if (!jobId) {
    throw new EmotionProviderError(EMOTION_ERROR_CODES.UNAVAILABLE, 'Hume job_id missing', jobData)
  }

  const maxPollCount = 12
  for (let index = 0; index < maxPollCount; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const statusData = await fetchJson(`https://api.hume.ai/v0/batch/jobs/${jobId}`, {
      headers: {
        'X-Hume-Api-Key': apiKey,
      },
      timeoutMs,
    })

    const status = `${statusData?.state ?? ''}`.toUpperCase()
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
        {
          headers: {
            'X-Hume-Api-Key': apiKey,
          },
          timeoutMs,
        },
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
