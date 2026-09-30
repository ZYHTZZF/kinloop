import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { UPLOADS_DIR, VOLCANO_API_KEY, VOLCANO_ENDPOINT } from '../config.mjs'

const uploadTasks = new Map()

export async function proxyVolcanoRequest(method, path, body, headers = {}) {
  if (!VOLCANO_API_KEY) {
    throw new Error('Volcano API Key is not configured')
  }

  const response = await fetch(`${VOLCANO_ENDPOINT}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOLCANO_API_KEY}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const text = await safeText(response)
    throw new Error(`Volcano API ${response.status}: ${text}`)
  }

  return response.json()
}

export function registerVolcanoRoutes(app) {
  app.get('/api/volcano/status/:taskId', async (req, res) => {
    try {
      const task = uploadTasks.get(req.params.taskId)
      if (task) {
        res.json({
          status: task.status,
          result: {
            url: task.url,
            mediaType: task.mediaType,
            fileName: task.fileName,
          },
        })
        return
      }

      const result = await proxyVolcanoRequest(
        'GET',
        `/tasks/${req.params.taskId}/status`,
        null,
        sanitizeProxyHeaders(req.headers),
      )
      res.json(result)
    } catch (error) {
      console.error('[Volcano] status failed:', error)
      res.status(500).json({ error: 'Failed to query volcano processing status' })
    }
  })

  app.post('/api/volcano/upload/:type', async (req, res) => {
    try {
      const uploadType = req.params.type
      if (uploadType !== 'audio' && uploadType !== 'video') {
        res.status(400).json({ error: 'Unsupported upload type' })
        return
      }

      const base64Data = String(req.body?.base64Data ?? '')
      const format = String(req.body?.format ?? defaultFormat(uploadType))
      if (!base64Data) {
        res.status(400).json({ error: 'base64Data is required' })
        return
      }

      const buffer = Buffer.from(base64Data, 'base64')
      if (!buffer.length) {
        res.status(400).json({ error: 'Invalid upload payload' })
        return
      }

      const taskId = `task_${Date.now()}_${randomUUID().slice(0, 8)}`
      const fileName = `${taskId}.${normalizeExtension(format, uploadType)}`
      const targetDir = resolve(UPLOADS_DIR, uploadType)
      await mkdir(targetDir, { recursive: true })
      await writeFile(resolve(targetDir, fileName), buffer)

      const url = `/uploads/${uploadType}/${fileName}`
      const task = {
        taskId,
        url,
        status: 'completed',
        mediaType: uploadType,
        fileName,
      }
      uploadTasks.set(taskId, task)

      res.json({
        taskId,
        url,
        status: 'completed',
      })
    } catch (error) {
      console.error('[Volcano] upload failed:', error)
      res.status(500).json({ error: 'Failed to upload media for volcano processing' })
    }
  })

  app.get('/api/volcano/*path', async (req, res) => {
    try {
      const path = req.params.path ? `/${req.params.path}` : ''
      const result = await proxyVolcanoRequest('GET', path, null, sanitizeProxyHeaders(req.headers))
      res.json(result)
    } catch (error) {
      console.error('[Volcano] GET failed:', error)
      res.status(500).json({ error: 'Volcano API request failed' })
    }
  })

  app.post('/api/volcano/*path', async (req, res) => {
    try {
      const path = req.params.path ? `/${req.params.path}` : ''
      const result = await proxyVolcanoRequest('POST', path, req.body, sanitizeProxyHeaders(req.headers))
      res.json(result)
    } catch (error) {
      console.error('[Volcano] POST failed:', error)
      res.status(500).json({ error: 'Volcano API request failed' })
    }
  })
}

function sanitizeProxyHeaders(headers = {}) {
  const nextHeaders = { ...headers }
  delete nextHeaders.host
  delete nextHeaders.connection
  delete nextHeaders['content-length']
  return nextHeaders
}

function normalizeExtension(format, uploadType) {
  const clean = String(format || '').trim().toLowerCase()
  if (clean) {
    return clean.replace(/^\./, '')
  }

  return defaultFormat(uploadType)
}

function defaultFormat(uploadType) {
  return uploadType === 'video' ? 'mp4' : 'wav'
}

async function safeText(response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
