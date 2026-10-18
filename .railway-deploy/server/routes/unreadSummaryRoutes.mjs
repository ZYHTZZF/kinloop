import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } from '../config.mjs'
import { getConversationDetail } from '../repositories/conversationRepository.mjs'

const REQUEST_TIMEOUT_MS = 60000

const TEXT = {
  missingConversationId: 'conversationId is required',
  invalidRole: 'requesterRole must be elder or family',
  conversationNotFound: 'Conversation not found',
  failed: 'Unread summary failed',
}

export function registerUnreadSummaryRoutes(app) {
  app.post('/api/ai/unread-summary', async (req, res) => {
    try {
      const conversationId = normalizeText(req.body?.conversationId)
      const requesterRole = normalizeRole(req.body?.requesterRole)

      if (!conversationId) {
        res.status(400).json({ error: TEXT.missingConversationId })
        return
      }

      if (!requesterRole) {
        res.status(400).json({ error: TEXT.invalidRole })
        return
      }

      const conversation = getConversationDetail(conversationId)
      if (!conversation) {
        res.status(404).json({ error: TEXT.conversationNotFound })
        return
      }

      const unreadMessages = pickUnreadMessages(conversation.messages, requesterRole)
      if (unreadMessages.length === 0) {
        res.json(buildEmptyPayload())
        return
      }

      if (!LLM_API_KEY || !LLM_MODEL) {
        res.json(buildFallbackPayload(conversation, unreadMessages, requesterRole))
        return
      }

      try {
        const result = await summarizeWithLlm({
          conversation,
          unreadMessages,
          requesterRole,
        })
        res.json(result)
      } catch (error) {
        console.warn('[UnreadSummary] LLM failed, fallback:', error)
        res.json(buildFallbackPayload(conversation, unreadMessages, requesterRole))
      }
    } catch (error) {
      console.error('[UnreadSummary] request failed:', error)
      res.status(500).json({ error: TEXT.failed })
    }
  })
}

async function summarizeWithLlm({ conversation, unreadMessages, requesterRole }) {
  const speakerLabel = requesterRole === 'elder'
    ? conversation.familyDisplayName
    : conversation.elderDisplayName

  const systemPrompt = [
    '你是聊天未读消息摘要助手。',
    '你的任务是把一段未读消息总结成适合快速扫一眼的摘要。',
    '输出要求：',
    '1) summary 用 2 到 4 句话概括对方最近说了什么、情绪和希望你注意什么。',
    '2) highlights 是 2 到 4 条要点，每条一句话，不要重复。',
    '3) 不要编造没有出现过的信息。',
    '4) 如果有图片、语音、视频，只能根据附言或转写做概括，不能臆测画面细节。',
    '严格输出 JSON：{"summary":"...","highlights":["..."]}',
  ].join('\n')

  const userPrompt = [
    `当前查看身份：${requesterRole === 'elder' ? '老人端' : '子女端'}`,
    `对方姓名：${speakerLabel}`,
    `未读消息数：${unreadMessages.length}`,
    '未读消息列表：',
    unreadMessages.map((message, index) => formatPromptMessage(message, speakerLabel, index)).join('\n'),
  ].join('\n')

  const payload = {
    model: LLM_MODEL,
    temperature: 0.2,
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
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
      const retryPayload = { ...payload, response_format: undefined }
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
  const summary = normalizeText(parsed.summary) || buildFallbackSummary(conversation, unreadMessages, requesterRole)
  const highlights = normalizeHighlights(parsed.highlights, unreadMessages)

  return {
    unreadCount: unreadMessages.length,
    summary,
    highlights,
    mode: 'llm',
  }
}

function buildEmptyPayload() {
  return {
    unreadCount: 0,
    summary: '现在没有新的未读消息。',
    highlights: [],
    mode: 'fallback',
  }
}

function buildFallbackPayload(conversation, unreadMessages, requesterRole) {
  return {
    unreadCount: unreadMessages.length,
    summary: buildFallbackSummary(conversation, unreadMessages, requesterRole),
    highlights: unreadMessages
      .slice(-3)
      .map((message) => buildFallbackHighlight(message))
      .filter(Boolean),
    mode: 'fallback',
  }
}

function buildFallbackSummary(conversation, unreadMessages, requesterRole) {
  const speakerLabel = requesterRole === 'elder'
    ? conversation.familyDisplayName
    : conversation.elderDisplayName
  const textCount = unreadMessages.filter((message) => message.messageType === 'Text').length
  const voiceCount = unreadMessages.filter((message) => message.messageType === 'Voice').length
  const imageCount = unreadMessages.filter((message) => message.messageType === 'Image').length
  const videoCount = unreadMessages.filter((message) => message.messageType === 'Video').length
  const countParts = []

  if (textCount > 0) countParts.push(`${textCount} 条文字`)
  if (voiceCount > 0) countParts.push(`${voiceCount} 条语音`)
  if (imageCount > 0) countParts.push(`${imageCount} 张图片`)
  if (videoCount > 0) countParts.push(`${videoCount} 条视频`)

  const latestMessage = unreadMessages[unreadMessages.length - 1]
  const latestSnippet = buildFallbackHighlight(latestMessage)

  return `${speakerLabel} 发来了 ${unreadMessages.length} 条未读消息，包含${countParts.join('、') || '多种内容'}。最近一条大意是：${latestSnippet || '请点开聊天查看详情。'}`
}

function buildFallbackHighlight(message) {
  const content = describeMessage(message)
  return content.length > 48 ? `${content.slice(0, 48)}...` : content
}

function pickUnreadMessages(messages, requesterRole) {
  const peerSenderType = requesterRole === 'elder' ? 'Family' : 'Elder'

  return messages.filter((message) => (
    message.senderType === peerSenderType
    && !message.consumedAt
    && !message.recalledAt
  ))
}

function formatPromptMessage(message, speakerLabel, index) {
  const dateLabel = formatTimestamp(message.createdAt)
  return `${index + 1}. [${dateLabel}] ${speakerLabel}：${describeMessage(message)}`
}

function describeMessage(message) {
  if (message.messageType === 'Voice') {
    const transcript = normalizeText(message.transcript)
    return transcript ? `语音，转写为：${transcript}` : '一条语音消息'
  }

  if (message.messageType === 'Image') {
    const text = normalizeText(message.textContent)
    return text ? `图片，附言：${text}` : '一张图片'
  }

  if (message.messageType === 'Video') {
    const text = normalizeText(message.textContent)
    return text ? `视频，附言：${text}` : '一条视频'
  }

  return normalizeText(message.textContent) || '一条文字消息'
}

function formatTimestamp(value) {
  if (!value) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value))
}

function normalizeRole(value) {
  return value === 'elder' || value === 'family' ? value : ''
}

function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeHighlights(value, unreadMessages) {
  if (!Array.isArray(value)) {
    return unreadMessages.slice(-3).map((message) => buildFallbackHighlight(message)).filter(Boolean)
  }

  const nextHighlights = value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 4)

  if (nextHighlights.length > 0) {
    return nextHighlights
  }

  return unreadMessages.slice(-3).map((message) => buildFallbackHighlight(message)).filter(Boolean)
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
