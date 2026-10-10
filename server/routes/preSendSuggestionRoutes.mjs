import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } from '../config.mjs'

const REQUEST_TIMEOUT_MS = 20000

export function registerPreSendSuggestionRoutes(app) {
  app.post('/api/ai/pre-send-suggestions', async (req, res) => {
    try {
      const conversationId = String(req.body?.conversationId ?? '').trim()
      const draft = String(req.body?.draft ?? '').trim()
      const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-5) : []

      if (!conversationId) {
        res.status(400).json({ error: 'conversationId is required' })
        return
      }

      if (!draft) {
        res.status(400).json({ error: 'draft is required' })
        return
      }

      if (!LLM_API_KEY || !LLM_MODEL) {
        res.json({ ok: true, result: null, source: 'fallback' })
        return
      }

      try {
        const result = await explainWithLlm({ conversationId, draft, messages })
        res.json({ ok: true, result, source: 'llm' })
      } catch (error) {
        console.warn('[PreSendSuggestion] LLM failed, fallback:', error)
        res.json({ ok: true, result: null, source: 'fallback' })
      }
    } catch (error) {
      console.error('[PreSendSuggestion] request failed:', error)
      res.status(500).json({ error: 'pre-send suggestion failed' })
    }
  })
}

async function explainWithLlm({ conversationId, draft, messages }) {
  const systemPrompt = [
    'You are a Chinese pre-send assistant for intergenerational chat.',
    'Decide whether the current draft needs a send-before suggestion.',
    'Prefer type=soften over type=followup when both apply.',
    'Only return JSON.',
    'If no suggestion is needed, return {"shouldSuggest":false}.',
    'If suggestion is needed, return keys shouldSuggest,type,title,reason,suggestions,triggerKey.',
    'type must be soften or followup.',
    'title and reason must be concise Chinese.',
    'suggestions must contain 1 or 2 concise Chinese alternatives that preserve the original intent.',
    'Do not moralize, do not exaggerate, and do not output markdown.',
  ].join('\n')

  const payload = {
    model: LLM_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: JSON.stringify({ conversationId, draft, messages }),
      },
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
    if (/response_format|json_object/i.test(text)) {
      response = await fetchWithTimeout(
        `${LLM_BASE_URL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LLM_API_KEY}`,
          },
          body: JSON.stringify({
            ...payload,
            response_format: undefined,
          }),
        },
        REQUEST_TIMEOUT_MS,
      )
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

  if (parsed?.shouldSuggest === false) {
    return null
  }

  return sanitizePreSendSuggestion(parsed)
}

function sanitizePreSendSuggestion(result) {
  if (!result || typeof result !== 'object') {
    return null
  }

  const type = result.type === 'soften' ? 'soften' : result.type === 'followup' ? 'followup' : null
  const title = asText(result.title)
  const reason = asText(result.reason)
  const suggestions = Array.isArray(result.suggestions)
    ? result.suggestions.map((item) => asText(item)).filter(Boolean).slice(0, 2)
    : []
  const triggerKey = asText(result.triggerKey)

  if (!type || !title || !reason || !triggerKey || suggestions.length === 0) {
    return null
  }

  return {
    shouldSuggest: true,
    type,
    title,
    reason,
    suggestions,
    triggerKey,
  }
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
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
