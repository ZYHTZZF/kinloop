import { randomUUID } from 'node:crypto'
import {
  ASR_MODEL,
  LLM_API_KEY,
  LLM_BASE_URL,
  VOLC_ASR_ACCESS_TOKEN,
  VOLC_ASR_APP_ID,
  VOLC_ASR_RESOURCE_ID,
} from '../config.mjs'

export function registerAsrRoutes(app) {
  app.post('/api/asr/transcribe', async (req, res) => {
    try {
      const audioBase64 = String(req.body?.audioBase64 ?? '')
      const mimeType = String(req.body?.mimeType ?? 'audio/webm')

      if (!audioBase64) {
        res.status(400).json({ error: 'audioBase64 is required' })
        return
      }

      const buffer = Buffer.from(audioBase64, 'base64')
      if (!buffer.length) {
        res.status(400).json({ error: 'invalid audio payload' })
        return
      }

      const volcResult = await tryVolcAsr(buffer)
      if (volcResult.ok) {
        res.json({ ok: true, text: volcResult.text })
        return
      }

      // fallback to OpenAI-compatible transcription endpoint
      if (!LLM_API_KEY) {
        return
      }

      if (!ASR_MODEL) {
        res.status(503).json({ error: 'ASR model missing: set KINLOOP_ASR_MODEL' })
        return
      }

      const candidates = buildAsrCandidates(LLM_BASE_URL)
      const extension = normalizeAudioExt(mimeType)
      const errors = volcResult.errors.slice()

      for (const endpoint of candidates) {
        const form = new FormData()
        form.append('model', ASR_MODEL)
        form.append('language', 'zh')
        form.append('response_format', 'json')
        form.append('file', new Blob([buffer], { type: mimeType }), `speech.${extension}`)

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LLM_API_KEY}`,
          },
          body: form,
        })

        if (response.ok) {
          const payload = await response.json()
          const text = String(payload?.text ?? '').trim()
          res.json({ ok: true, text })
          return
        }

        const message = await safeText(response)
        errors.push(`ASR HTTP ${response.status} @ ${endpoint}: ${message}`)
      }

      res.status(502).json({ error: `ASR failed on all endpoints. ${errors.join(' | ')}` })
    } catch (error) {
      console.error('[ASR] transcribe failed:', error)
      res.status(500).json({ error: 'ASR transcribe failed' })
    }
  })
}

async function tryVolcAsr(buffer) {
  if (!VOLC_ASR_APP_ID || !VOLC_ASR_ACCESS_TOKEN) {
    return { ok: false, errors: ['Volc ASR missing config: KINLOOP_VOLC_ASR_APP_ID / KINLOOP_VOLC_ASR_ACCESS_TOKEN'] }
  }

  const endpoint = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash'
  const requestBody = {
    user: { uid: VOLC_ASR_APP_ID },
    audio: { data: buffer.toString('base64') },
    request: { model_name: 'bigmodel' },
  }

  const resourceCandidates = Array.from(new Set([
    VOLC_ASR_RESOURCE_ID,
    'volc.bigasr.auc',
    'volc.bigasr.auc_turbo',
  ].filter(Boolean)))
  const authHeaderCandidates = [
    { Authorization: `Bearer ${VOLC_ASR_ACCESS_TOKEN}` },
    { 'X-Api-Access-Key': VOLC_ASR_ACCESS_TOKEN },
    { 'X-Api-Token': VOLC_ASR_ACCESS_TOKEN },
    {
      Authorization: `Bearer ${VOLC_ASR_ACCESS_TOKEN}`,
      'X-Api-Access-Key': VOLC_ASR_ACCESS_TOKEN,
    },
    {
      Authorization: `Bearer ${VOLC_ASR_ACCESS_TOKEN}`,
      'X-Api-Token': VOLC_ASR_ACCESS_TOKEN,
    },
  ]

  const errors = []
  for (const resourceId of resourceCandidates) {
    for (const authHeaders of authHeaderCandidates) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'X-Api-App-Key': VOLC_ASR_APP_ID,
          'X-Api-Resource-Id': resourceId,
          'X-Api-Request-Id': randomUUID(),
          'X-Api-Sequence': '-1',
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const message = await safeText(response)
        errors.push(`Volc ASR HTTP ${response.status} [${resourceId}] [${Object.keys(authHeaders).join('+')}]: ${message}`)
        continue
      }

      const statusCode = String(response.headers.get('X-Api-Status-Code') ?? '')
      const statusMessage = String(response.headers.get('X-Api-Message') ?? '')
      const payload = await response.json()
      if (statusCode && statusCode !== '20000000') {
        errors.push(`Volc ASR status ${statusCode} [${resourceId}] [${Object.keys(authHeaders).join('+')}]: ${statusMessage || 'unknown error'}`)
        continue
      }

      const text = extractVolcText(payload)
      if (!text) {
        errors.push(`Volc ASR empty text [${resourceId}] [${Object.keys(authHeaders).join('+')}]`)
        continue
      }
      return { ok: true, text, errors: [] }
    }
  }

  return { ok: false, errors }
}

function extractVolcText(payload) {
  const direct = String(payload?.result?.text ?? payload?.text ?? '').trim()
  if (direct) return direct
  const utterances = Array.isArray(payload?.result?.utterances) ? payload.result.utterances : []
  return utterances.map((item) => String(item?.text ?? '').trim()).filter(Boolean).join('')
}

function normalizeAudioExt(mimeType) {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('mpeg')) return 'mp3'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

async function safeText(response) {
  try {
    return await response.text()
  } catch {
    return 'unknown error'
  }
}

function buildAsrCandidates(baseUrl) {
  const cleanBase = String(baseUrl || '').replace(/\/+$/, '')
  const candidates = new Set()

  if (cleanBase) {
    candidates.add(`${cleanBase}/audio/transcriptions`)
  }

  try {
    const base = new URL(cleanBase)
    const origin = base.origin
    candidates.add(`${origin}/api/v3/audio/transcriptions`)
    candidates.add(`${origin}/api/v1/audio/transcriptions`)
    candidates.add(`${origin}/v1/audio/transcriptions`)
  } catch {
    // ignore invalid URL
  }

  return [...candidates]
}
