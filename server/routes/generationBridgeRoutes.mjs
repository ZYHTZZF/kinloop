import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, UPLOADS_DIR } from '../config.mjs'

const REQUEST_TIMEOUT_MS = 60000

const TEXT = {
  missingInput: 'messageText or imageUrl is required',
  failed: 'Generation bridge explanation failed',
  fallbackExplain: '\u6682\u65f6\u6ca1\u80fd\u7a33\u5b9a\u89e3\u6790\u8fd9\u6761\u5185\u5bb9\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002',
  fallbackSuggest: '\u4f60\u53ef\u4ee5\u5148\u8fd9\u6837\u56de\uff1a\u6211\u60f3\u66f4\u597d\u5730\u7406\u89e3\u4f60\uff0c\u4f60\u80fd\u518d\u8bf4\u5f97\u8be6\u7ec6\u4e00\u70b9\u5417\uff1f',
}

export function registerGenerationBridgeRoutes(app) {
  app.post('/api/ai/generation-bridge/explain', async (req, res) => {
    try {
      const messageText = normalizeText(req.body?.messageText)
      const imageUrl = normalizeText(req.body?.imageUrl)

      if (!messageText && !imageUrl) {
        res.status(400).json({ error: TEXT.missingInput })
        return
      }

      if (!LLM_API_KEY || !LLM_MODEL) {
        res.json(buildFallbackPayload())
        return
      }

      try {
        const result = await explainWithLlm({ messageText, imageUrl })
        res.json(result)
      } catch (error) {
        console.warn('[GenerationBridge] LLM failed, fallback:', error)
        res.json(buildFallbackPayload())
      }
    } catch (error) {
      console.error('[GenerationBridge] request failed:', error)
      res.status(500).json({ error: TEXT.failed })
    }
  })
}

async function explainWithLlm({ messageText, imageUrl }) {
  const systemPrompt = [
    '\u4f60\u662f\u201c\u4ee3\u9645\u6c9f\u901a\u7ffb\u8bd1\u52a9\u624b\u201d\u3002',
    '\u76ee\u6807\u53ea\u6709\u4e24\u4e2a\uff1a',
    '1) \u7528\u7b80\u5355\u81ea\u7136\u7684\u4e2d\u6587\u89e3\u91ca\u201c\u5bf9\u65b9\u8fd9\u53e5\u8bdd/\u8fd9\u5f20\u56fe\u60f3\u8868\u8fbe\u4ec0\u4e48\u201d\u3002',
    '2) \u7ed9\u4e00\u53e5\u53ef\u76f4\u63a5\u53d1\u9001\u7684\u5efa\u8bae\u56de\u590d\uff08\u9700\u8981\u6709\u5171\u60c5\uff0c\u4e0d\u751f\u786c\uff09\u3002',
    '\u786c\u6027\u8981\u6c42\uff1a',
    '- \u4e0d\u8981\u8f93\u51fa\u201c\u8fd9\u53e5\u8bdd\u7684\u610f\u601d\u662f\uff1a\u201d\u6216\u201c\u4f60\u53ef\u4ee5\u56de\u590d\uff1a\u201d\u8fd9\u7c7b\u524d\u7f00',
    '- \u4e0d\u8981\u7f16\u9020\u80cc\u666f\uff0c\u4e0d\u8981\u4e71\u731c\u8eab\u4efd',
    '- \u5efa\u8bae\u56de\u590d\u8981\u5177\u4f53\uff0c\u4e0d\u8981\u7a7a\u6cdb\u8ffd\u95ee',
    '- \u82e5\u5185\u5bb9\u786e\u5b9e\u4e0d\u6e05\u6670\uff0c\u660e\u786e\u8bf4\u4e0d\u786e\u5b9a\uff0c\u518d\u7ed9\u4e00\u53e5\u6e29\u548c\u6c42\u8865\u5145\u7684\u56de\u590d',
    '\u4e25\u683c JSON \u8f93\u51fa\uff1a{"explanation":"...","followUpSuggestion":"..."}',
  ].join('\n')

  const userParts = []
  if (messageText) {
    userParts.push(`\u6587\u672c\u5185\u5bb9\uff1a${messageText}`)
  }
  if (imageUrl) {
    userParts.push('\u56fe\u7247\u5185\u5bb9\u89e3\u6790\uff1a\u8bf7\u7ed3\u5408\u56fe\u7247\u7406\u89e3\u6897\u610f\u3001\u8bed\u6c14\u548c\u60c5\u7eea\u3002')
  }
  const userText = userParts.join('\n')

  const preparedImageUrl = await prepareImageUrlForModel(imageUrl)

  const userMessage = preparedImageUrl
    ? {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: preparedImageUrl } },
        ],
      }
    : { role: 'user', content: userText }

  const payload = {
    model: LLM_MODEL,
    temperature: 0.2,
    max_tokens: 300,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      userMessage,
    ],
  }

  let response = await fetchWithTimeout(
    `${LLM_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify(payload),
    },
    REQUEST_TIMEOUT_MS,
  )

  if (!response.ok && response.status === 400) {
    const text = await safeText(response)
    // Retry without response_format for providers that don't support json_object.
    const retryPayload = { ...payload, response_format: undefined }
    if (/response_format|json_object/i.test(text)) {
      response = await fetchWithTimeout(
        `${LLM_BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LLM_API_KEY}`,
          },
          body: JSON.stringify(retryPayload),
        },
        REQUEST_TIMEOUT_MS,
      )
    } else if (/image|vision|multimodal/i.test(text)) {
      throw new Error(`Current model does not support image input: ${text}`)
    } else {
      throw new Error(`LLM HTTP 400: ${text}`)
    }
  }

  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status}: ${await safeText(response)}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  const parsed = tryParseJson(typeof content === 'string' ? content : '{}')

  const explanation = normalizeText(parsed.explanation)
  const followUpSuggestion = normalizeText(parsed.followUpSuggestion)

  return {
    explanation: explanation || TEXT.fallbackExplain,
    followUpSuggestion: followUpSuggestion || TEXT.fallbackSuggest,
    glossary: [],
    mode: 'llm',
  }
}

async function prepareImageUrlForModel(imageUrl) {
  const raw = normalizeText(imageUrl)
  if (!raw) return ''
  if (raw.startsWith('data:')) return raw

  if (raw.startsWith('/uploads/')) {
    const relative = raw.slice('/uploads/'.length).replace(/\\/g, '/')
    const safeRoot = resolve(UPLOADS_DIR)
    const absolute = resolve(safeRoot, relative)
    if (!absolute.startsWith(safeRoot + sep) && absolute !== safeRoot) {
      return raw
    }
    try {
      const bin = await readFile(absolute)
      const mime = guessMimeFromPath(absolute)
      return `data:${mime};base64,${bin.toString('base64')}`
    } catch {
      return raw
    }
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      return await downloadUrlAsDataUrl(raw)
    } catch {
      return raw
    }
  }

  return raw
}

async function downloadUrlAsDataUrl(url) {
  const res = await fetchWithTimeout(
    url,
    { method: 'GET' },
    12000,
  )
  if (!res.ok) {
    throw new Error(`Download image failed: ${res.status}`)
  }
  const contentType = res.headers.get('content-type') || guessMimeFromPath(url)
  const arr = await res.arrayBuffer()
  const base64 = Buffer.from(arr).toString('base64')
  return `data:${contentType};base64,${base64}`
}

function guessMimeFromPath(path) {
  const ext = extname(path).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.bmp') return 'image/bmp'
  return 'image/png'
}

function buildFallbackPayload() {
  return {
    explanation: TEXT.fallbackExplain,
    followUpSuggestion: TEXT.fallbackSuggest,
    glossary: [],
    mode: 'fallback',
  }
}

function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function tryParseJson(content) {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(match[0])
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function safeText(response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
