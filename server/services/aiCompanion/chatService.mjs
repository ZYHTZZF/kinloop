import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } from '../../config.mjs'

const REQUEST_TIMEOUT_MS = 45000
const MAX_CONTEXT_MESSAGES = 12
const FALLBACK_REPLY = '我喺度陪住你。頭先嗰句我收到，你可以慢慢講，我會繼續聽。'

export async function generateAiCompanionReply(conversation) {
  const latestUserText = extractLatestUserText(conversation)
  if (!latestUserText) {
    return '我頭先聽得唔係好清楚。你可以再講一次，我會認真聽。'
  }

  if (!LLM_API_KEY || !LLM_MODEL) {
    return FALLBACK_REPLY
  }

  try {
    const response = await fetchWithTimeout(
      `${LLM_BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          temperature: 0.6,
          max_tokens: 220,
          messages: [
            { role: 'system', content: buildSystemPrompt(conversation) },
            ...buildConversationContext(conversation),
          ],
        }),
      },
      REQUEST_TIMEOUT_MS,
    )

    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}: ${await safeText(response)}`)
    }

    const payload = await response.json()
    const content = normalizeReply(payload?.choices?.[0]?.message?.content)
    return content || FALLBACK_REPLY
  } catch (error) {
    console.warn('[AI Companion] LLM failed, using fallback:', error)
    return FALLBACK_REPLY
  }
}

function buildSystemPrompt(conversation) {
  const elderName = normalizeText(conversation?.elderDisplayName) || '長輩'

  return [
    '你係「銀齡心語」嘅銀齡陪伴聊天助手。',
    `你而家陪緊嘅老人稱呼係：${elderName}。`,
    '請用自然、溫和、容易聽明嘅廣東話/粵語口吻回覆，盡量用繁體中文。',
    '回覆要短，通常 1 到 3 句，適合直接用粵語語音播報。',
    '先接住對方情緒，再輕輕回應；唔好說教，唔好輸出列表，唔好用 Markdown。',
    '如果老人表達身體唔舒服或者有危險，先安撫，然後建議即刻聯絡屋企人或者打急救電話。',
  ].join('\n')
}

function buildConversationContext(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
  const context = messages
    .map(toLlmMessage)
    .filter(Boolean)
    .slice(-MAX_CONTEXT_MESSAGES)

  if (context.length === 0) {
    return [{ role: 'user', content: '我想同你傾下偈。' }]
  }

  return context
}

function toLlmMessage(message) {
  const content = normalizeText(message?.textContent) || normalizeText(message?.transcript)
  if (!content) {
    return null
  }

  if (message.senderType === 'Elder') {
    return { role: 'user', content }
  }

  if (message.senderType === 'System') {
    return { role: 'assistant', content: stripAiPrefix(content) }
  }

  return null
}

function extractLatestUserText(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.senderType !== 'Elder') continue
    const text = normalizeText(message.textContent) || normalizeText(message.transcript)
    if (text) return text
  }
  return ''
}

function stripAiPrefix(text) {
  return text.replace(/^(AI回复：|AI追问：|AI助手：|AI回覆：|AI追問：)\s*/, '')
}

function normalizeReply(value) {
  return normalizeText(value)
    .replace(/^["“”]+|["“”]+$/g, '')
    .replace(/^(AI回复：|AI助手：|AI回覆：|AI追問：)\s*/, '')
    .trim()
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
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
