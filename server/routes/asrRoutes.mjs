import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  ASR_MODEL,
  ASR_API_KEY,
  ASR_BASE_URL,
  UPLOADS_DIR,
  VOLC_ASR_ACCESS_TOKEN,
  VOLC_ASR_API_KEY,
  VOLC_ASR_APP_ID,
  VOLC_ASR_CLUSTER,
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

      const volcResult = await tryVolcAsr(buffer, mimeType, req)
      if (volcResult.ok) {
        res.json({ ok: true, text: volcResult.text })
        return
      }

      // fallback to OpenAI-compatible transcription endpoint
      if (!ASR_API_KEY) {
        res.status(503).json({ error: 'ASR provider is not configured: missing KINLOOP_ASR_API_KEY or KINLOOP_LLM_API_KEY' })
        return
      }

      if (!ASR_MODEL) {
        res.status(503).json({ error: 'ASR model missing: set KINLOOP_ASR_MODEL' })
        return
      }

      const candidates = buildAsrCandidates(ASR_BASE_URL)
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
            Authorization: `Bearer ${ASR_API_KEY}`,
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

async function tryVolcAsr(buffer, mimeType, req) {
  const authHeaders = buildVolcAuthHeaders()
  if (!VOLC_ASR_APP_ID || !authHeaders.length) {
    return { ok: false, errors: ['Volc ASR missing config: set KINLOOP_VOLC_ASR_APP_ID and KINLOOP_VOLC_ASR_ACCESS_TOKEN or KINLOOP_VOLC_ASR_API_KEY'] }
  }

  const resourceCandidates = Array.from(new Set([
    VOLC_ASR_RESOURCE_ID,
    'volc.bigasr.auc',
    'volc.bigasr.auc_turbo',
  ].filter(Boolean)))

  const errors = []
  for (const resourceId of resourceCandidates) {
    for (const authHeader of authHeaders) {
      const result = resourceId.endsWith('_turbo')
        ? await tryVolcFlashAsr(buffer, resourceId, authHeader)
        : await tryVolcSubmitQueryAsr(buffer, mimeType, req, resourceId, authHeader)

      if (result.ok) {
        return result
      }

      errors.push(...result.errors)
    }
  }

  return { ok: false, errors }
}

async function tryVolcFlashAsr(buffer, resourceId, authHeaders) {
  const endpoint = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash'
  const requestBody = {
    user: { uid: VOLC_ASR_APP_ID },
    audio: { data: buffer.toString('base64') },
    request: { model_name: 'bigmodel' },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-Api-App-Key': VOLC_ASR_APP_ID,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': randomUUID(),
      'X-Api-Sequence': '-1',
      'Content-Type': 'application/json',
      ...authHeaders.headers,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const message = await safeText(response)
    return { ok: false, errors: [`Volc ASR HTTP ${response.status} [${resourceId}] [${authHeaders.label}]: ${message}`] }
  }

  const statusCode = String(response.headers.get('X-Api-Status-Code') ?? '')
  const statusMessage = String(response.headers.get('X-Api-Message') ?? '')
  const payload = await response.json()
  if (statusCode && statusCode !== '20000000') {
    return { ok: false, errors: [`Volc ASR status ${statusCode} [${resourceId}] [${authHeaders.label}]: ${statusMessage || 'unknown error'}`] }
  }

  const text = extractVolcText(payload)
  if (!text) {
    return { ok: false, errors: [`Volc ASR empty text [${resourceId}] [${authHeaders.label}]`] }
  }

  return { ok: true, text, errors: [] }
}

async function tryVolcSubmitQueryAsr(buffer, mimeType, req, resourceId, authHeaders) {
  if (!VOLC_ASR_CLUSTER) {
    return { ok: false, errors: [`Volc ASR cluster missing for standard submit/query [${resourceId}]`] }
  }

  const requestId = randomUUID()
  const audioUrl = await createTemporaryUploadUrl(buffer, mimeType, requestId, req)
  const submitEndpoint = 'https://openspeech.bytedance.com/api/v1/auc/submit'
  const queryEndpoint = 'https://openspeech.bytedance.com/api/v1/auc/query'

  const submitBody = {
    app: {
      appid: VOLC_ASR_APP_ID,
      token: VOLC_ASR_ACCESS_TOKEN,
      cluster: VOLC_ASR_CLUSTER,
    },
    user: {
      uid: req.get('x-user-id') || 'kinloop-server',
    },
    audio: {
      url: audioUrl,
      format: normalizeAudioExt(mimeType),
    },
  }

  const submitHeaders = {
    Authorization: `Bearer; ${VOLC_ASR_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }

  const queryHeaders = {
    Authorization: `Bearer; ${VOLC_ASR_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }

  const submitResponse = await fetch(submitEndpoint, {
    method: 'POST',
    headers: submitHeaders,
    body: JSON.stringify(submitBody),
  })

  if (!submitResponse.ok) {
    const message = await safeText(submitResponse)
    return { ok: false, errors: [`Volc ASR submit HTTP ${submitResponse.status} [${resourceId}] [${authHeaders.label}]: ${message}`] }
  }

  const submitStatusCode = String(submitResponse.headers.get('X-Api-Status-Code') ?? '')
  const submitStatusMessage = String(submitResponse.headers.get('X-Api-Message') ?? '')
  if (submitStatusCode && submitStatusCode !== '20000000') {
    return { ok: false, errors: [`Volc ASR submit status ${submitStatusCode} [${resourceId}] [${authHeaders.label}]: ${submitStatusMessage || 'unknown error'}`] }
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(attempt === 0 ? 1000 : 1500)

    const queryResponse = await fetch(queryEndpoint, {
      method: 'POST',
      headers: queryHeaders,
      body: JSON.stringify({
        app: {
          appid: VOLC_ASR_APP_ID,
          token: VOLC_ASR_ACCESS_TOKEN,
          cluster: VOLC_ASR_CLUSTER,
        },
        user: {
          uid: req.get('x-user-id') || 'kinloop-server',
        },
        audio: {
          url: audioUrl,
        },
        request: {
          reqid: requestId,
        },
      }),
    })

    if (!queryResponse.ok) {
      const message = await safeText(queryResponse)
      return { ok: false, errors: [`Volc ASR query HTTP ${queryResponse.status} [${resourceId}] [${authHeaders.label}]: ${message}`] }
    }

    const queryStatusCode = String(queryResponse.headers.get('X-Api-Status-Code') ?? '')
    const queryStatusMessage = String(queryResponse.headers.get('X-Api-Message') ?? '')
    const payload = await queryResponse.json()
    if (queryStatusCode && queryStatusCode !== '20000000') {
      return { ok: false, errors: [`Volc ASR query status ${queryStatusCode} [${resourceId}] [${authHeaders.label}]: ${queryStatusMessage || 'unknown error'}`] }
    }

    const text = extractVolcText(payload)
    if (text) {
      return { ok: true, text, errors: [] }
    }
  }

  return { ok: false, errors: [`Volc ASR query timed out [${resourceId}] [${authHeaders.label}]`] }
}

function buildVolcAuthHeaders() {
  const candidates = []
  if (VOLC_ASR_API_KEY) {
    candidates.push({ label: 'X-Api-Key', headers: { 'X-Api-Key': VOLC_ASR_API_KEY } })
  }
  if (VOLC_ASR_ACCESS_TOKEN) {
    candidates.push({ label: 'X-Api-Access-Key', headers: { 'X-Api-Access-Key': VOLC_ASR_ACCESS_TOKEN } })
  }
  return candidates
}

async function createTemporaryUploadUrl(buffer, mimeType, requestId, req) {
  const extension = normalizeAudioExt(mimeType)
  const targetDir = resolve(UPLOADS_DIR, 'asr')
  await mkdir(targetDir, { recursive: true })
  const fileName = `${requestId}.${extension}`
  await writeFile(resolve(targetDir, fileName), buffer)

  const protocol = resolvePublicProtocol(req)
  const host = req.get('x-forwarded-host') || req.get('host')
  return `${protocol}://${host}/uploads/asr/${fileName}`
}

function resolvePublicProtocol(req) {
  const forwardedProto = String(req.get('x-forwarded-proto') ?? '').split(',')[0].trim()
  if (forwardedProto) {
    return forwardedProto
  }
  return req.protocol === 'https' ? 'https' : 'http'
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
