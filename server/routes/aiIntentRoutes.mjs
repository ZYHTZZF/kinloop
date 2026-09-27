import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } from '../config.mjs'

const INTENT_TYPES = ['companion', 'chat', 'support', 'memory', 'clarify']
const NEXT_ACTIONS = ['stay', 'open_conversation', 'trigger_alert', 'save_memory', 'open_memories', 'clarify']
const URGENCY_LEVELS = ['none', 'normal', 'attention', 'emergency']
const MEMORY_ACTIONS = ['save_note', 'open_memory', null]

const REQUEST_TIMEOUT_MS = 12000
const MAX_ATTEMPTS = 2

const emergencyKeywords = ['救命', '救我', '胸口痛', '胸口很痛', '喘不上气', '摔倒', '晕倒', '快来', '急救', '危险', '120']
const supportKeywords = ['不舒服', '难受', '疼', '头晕', '心慌', '帮帮我', '联系家人']
const memorySaveKeywords = ['记一下', '记下来', '记住', '帮我记', '记到回忆']
const memoryOpenKeywords = ['看看照片', '翻照片', '相册', '回忆', '以前的照片', '之前的照片']
const chatKeywords = ['聊天', '联系', '发消息', '发信息', '发给', '告诉', '转告', '回复', '打开']
const autoSendKeywords = ['发给', '发消息', '发信息', '转告', '告诉', '回复', '带句话', '并发', '发我']

export function registerAiIntentRoutes(app) {
  app.post('/api/ai/elder-intent', async (req, res) => {
    try {
      const spokenText = String(req.body?.spokenText ?? '').trim()
      const members = Array.isArray(req.body?.members) ? req.body.members : []
      const conversations = Array.isArray(req.body?.conversations) ? req.body.conversations : []

      if (!spokenText) {
        res.status(400).json({ error: 'spokenText is required' })
        return
      }

      const ruleResult = classifyByRules(spokenText, members, conversations)

      if (!LLM_API_KEY || !LLM_MODEL) {
        // Keep old behavior for missing config so frontend fallback remains compatible.
        res.status(503).json({ error: 'LLM is not configured. Set KINLOOP_LLM_API_KEY and KINLOOP_LLM_MODEL.' })
        return
      }

      try {
        const aiResult = await inferElderIntentWithLlm({ spokenText, members, conversations })
        const merged = mergeRuleGuard(sanitizeIntent(aiResult, spokenText), ruleResult)
        res.json({ ok: true, result: merged })
      } catch (llmError) {
        console.warn('[AI Intent] LLM failed, fallback to rules:', llmError)
        res.json({ ok: true, result: ruleResult })
      }
    } catch (error) {
      console.error('[AI Intent] request failed:', error)
      res.status(500).json({ error: 'AI intent parsing failed' })
    }
  })
}

async function inferElderIntentWithLlm({ spokenText, members, conversations }) {
  const systemPrompt =
    'You are an intent parser for a Chinese elderly family-care assistant. ' +
    'Return JSON only. No markdown. No extra keys. ' +
    'Strong routing rules: ' +
    '1) Emergency symptoms must map to nextAction=trigger_alert, urgencyLevel=emergency. ' +
    '2) If user asks to contact/chat/send to family member, map to intentType=chat and nextAction=open_conversation. ' +
    '3) If user explicitly says send/tell/forward, set autoSendMessage=true and produce a short draftText. ' +
    '4) If confidence is low, use clarify.'

  const userPrompt = JSON.stringify(
    {
      task: 'Parse elder speech intent for action routing',
      spokenText,
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        displayName: m.displayName,
        elderAlias: m.elderAlias,
      })),
      conversations: conversations.map((c) => ({
        id: c.id,
        memberId: c.memberId,
        name: c.name,
        elderDisplayName: c.elderDisplayName,
      })),
      schema: {
        intentType: INTENT_TYPES,
        nextAction: NEXT_ACTIONS,
        urgencyLevel: URGENCY_LEVELS,
        memoryAction: ['save_note', 'open_memory', null],
        confidence: 'number(0~1)',
        requiresConfirmation: 'boolean',
        targetMemberId: 'string|null',
        targetMemberLabel: 'string|null',
        targetConversationId: 'string|null',
        promptTitle: 'string',
        promptBody: 'string',
        confirmLabel: 'string',
        draftText: 'string',
        autoSendMessage: 'boolean',
      },
      examples: [
        {
          spokenText: '打开和儿子聊天并发我今天挺好',
          expected: {
            intentType: 'chat',
            nextAction: 'open_conversation',
            autoSendMessage: true,
          },
        },
        {
          spokenText: '我现在胸口很痛快来救我',
          expected: {
            intentType: 'support',
            nextAction: 'trigger_alert',
            urgencyLevel: 'emergency',
          },
        },
      ],
    },
    null,
    2,
  )

  let lastError = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      }, REQUEST_TIMEOUT_MS)

      if (!response.ok) {
        const text = await safeText(response)
        const retriable = response.status >= 500 || response.status === 429
        const error = new Error(`LLM HTTP ${response.status}: ${text}`)
        if (retriable && attempt < MAX_ATTEMPTS) {
          lastError = error
          continue
        }
        throw error
      }

      const payload = await response.json()
      const content = payload?.choices?.[0]?.message?.content
      if (!content || typeof content !== 'string') {
        throw new Error('LLM returned empty content')
      }

      return tryParseJson(content)
    } catch (error) {
      const isTimeout = error?.name === 'AbortError'
      const isNetwork = error instanceof TypeError
      const retriable = isTimeout || isNetwork
      if (retriable && attempt < MAX_ATTEMPTS) {
        lastError = error
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error('LLM request failed after retries')
}

function sanitizeIntent(raw, spokenText) {
  const fallback = {
    spokenText,
    normalizedText: normalizeText(spokenText),
    intentType: 'clarify',
    targetMemberId: null,
    targetMemberLabel: null,
    targetConversationId: null,
    confidence: 0.42,
    requiresConfirmation: false,
    nextAction: 'clarify',
    urgencyLevel: 'none',
    memoryAction: null,
    promptTitle: '我还想再确认一下',
    promptBody: '你是想联系家人，还是先继续聊聊？',
    confirmLabel: '再说一次',
    draftText: '',
    autoSendMessage: false,
  }

  if (!raw || typeof raw !== 'object') return fallback

  const intentType = INTENT_TYPES.includes(raw.intentType) ? raw.intentType : fallback.intentType
  const nextAction = NEXT_ACTIONS.includes(raw.nextAction) ? raw.nextAction : fallback.nextAction
  const urgencyLevel = URGENCY_LEVELS.includes(raw.urgencyLevel) ? raw.urgencyLevel : fallback.urgencyLevel
  const memoryAction = MEMORY_ACTIONS.includes(raw.memoryAction) ? raw.memoryAction : fallback.memoryAction
  const confidence = Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, Number(raw.confidence))) : fallback.confidence

  return {
    spokenText,
    normalizedText: normalizeText(spokenText),
    intentType,
    targetMemberId: toNullableString(raw.targetMemberId),
    targetMemberLabel: toNullableString(raw.targetMemberLabel),
    targetConversationId: toNullableString(raw.targetConversationId),
    confidence,
    requiresConfirmation: Boolean(raw.requiresConfirmation),
    nextAction,
    urgencyLevel,
    memoryAction,
    promptTitle: asText(raw.promptTitle, fallback.promptTitle),
    promptBody: asText(raw.promptBody, fallback.promptBody),
    confirmLabel: asText(raw.confirmLabel, fallback.confirmLabel),
    draftText: asText(raw.draftText, ''),
    autoSendMessage: Boolean(raw.autoSendMessage),
  }
}

function classifyByRules(spokenText, members, conversations) {
  const normalizedText = normalizeText(spokenText)
  const fallback = {
    spokenText,
    normalizedText,
    intentType: 'clarify',
    targetMemberId: null,
    targetMemberLabel: null,
    targetConversationId: null,
    confidence: 0.42,
    requiresConfirmation: false,
    nextAction: 'clarify',
    urgencyLevel: 'none',
    memoryAction: null,
    promptTitle: '我还想再确认一下',
    promptBody: '你是想联系家人、需要帮助，还是先聊聊？',
    confirmLabel: '再说一次',
    draftText: '',
    autoSendMessage: false,
  }

  const target = matchMember(normalizedText, members, conversations)

  if (containsAny(normalizedText, emergencyKeywords)) {
    return {
      ...fallback,
      intentType: 'support',
      nextAction: 'trigger_alert',
      urgencyLevel: 'emergency',
      confidence: 0.99,
      targetMemberId: target?.memberId ?? null,
      targetMemberLabel: target?.memberLabel ?? '家人',
      targetConversationId: target?.conversationId ?? null,
      promptTitle: '我听到这是紧急情况',
      promptBody: '我会立刻通知家人并优先处理。',
      confirmLabel: '立即通知',
    }
  }

  if (containsAny(normalizedText, memoryOpenKeywords)) {
    return {
      ...fallback,
      intentType: 'memory',
      nextAction: 'open_memories',
      memoryAction: 'open_memory',
      confidence: 0.86,
      promptTitle: '我带你去看看之前的回忆',
      promptBody: '我这就打开最近保存的照片和记录。',
      confirmLabel: '去看看',
      targetMemberId: target?.memberId ?? null,
      targetMemberLabel: target?.memberLabel ?? null,
      targetConversationId: target?.conversationId ?? null,
    }
  }

  if (containsAny(normalizedText, memorySaveKeywords)) {
    return {
      ...fallback,
      intentType: 'memory',
      nextAction: 'save_memory',
      memoryAction: 'save_note',
      confidence: 0.9,
      requiresConfirmation: true,
      promptTitle: '这句话我可以帮你记下来',
      promptBody: '保存后你和家人之后都能看到。',
      confirmLabel: '帮我记下',
      draftText: spokenText,
      targetMemberId: target?.memberId ?? null,
      targetMemberLabel: target?.memberLabel ?? null,
      targetConversationId: target?.conversationId ?? null,
    }
  }

  const hasChatSignal = containsAny(normalizedText, chatKeywords)
  const hasTarget = Boolean(target)
  if (hasTarget && hasChatSignal) {
    const autoSend = containsAny(normalizedText, autoSendKeywords)
    return {
      ...fallback,
      intentType: 'chat',
      nextAction: 'open_conversation',
      confidence: 0.92,
      requiresConfirmation: true,
      targetMemberId: target.memberId,
      targetMemberLabel: target.memberLabel,
      targetConversationId: target.conversationId,
      promptTitle: `我听出来你想联系${target.memberLabel}`,
      promptBody: `我可以打开和${target.memberLabel}的对话。`,
      confirmLabel: `打开${target.memberLabel}`,
      draftText: extractChatDraft(spokenText, target.aliases),
      autoSendMessage: autoSend,
    }
  }

  if (containsAny(normalizedText, supportKeywords)) {
    return {
      ...fallback,
      intentType: 'support',
      nextAction: 'trigger_alert',
      urgencyLevel: normalizedText.includes('马上') || normalizedText.includes('赶紧') ? 'attention' : 'normal',
      confidence: 0.86,
      requiresConfirmation: true,
      targetMemberId: target?.memberId ?? null,
      targetMemberLabel: target?.memberLabel ?? '家人',
      targetConversationId: target?.conversationId ?? null,
      promptTitle: '我听到你需要帮助',
      promptBody: '我现在可以通知家人尽快联系你。',
      confirmLabel: '通知家人',
    }
  }

  return fallback
}

function mergeRuleGuard(llm, rule) {
  const normalizedText = llm.normalizedText || normalizeText(llm.spokenText)

  if (containsAny(normalizedText, emergencyKeywords)) {
    return {
      ...rule,
      confidence: Math.max(rule.confidence, llm.confidence),
    }
  }

  const llmWeak = llm.nextAction === 'clarify' || llm.confidence < 0.55
  const ruleStrong = rule.nextAction !== 'clarify' && rule.confidence >= 0.8
  if (llmWeak && ruleStrong) {
    return {
      ...rule,
      confidence: Math.max(rule.confidence, llm.confidence),
    }
  }

  if (llm.nextAction === 'open_conversation' && containsAny(normalizedText, autoSendKeywords)) {
    return {
      ...llm,
      autoSendMessage: true,
      draftText: llm.draftText || rule.draftText || '',
    }
  }

  if (llm.nextAction === 'open_conversation' && llm.targetMemberId && !llm.targetConversationId) {
    const patched = { ...llm }
    if (rule.targetMemberId === llm.targetMemberId && rule.targetConversationId) {
      patched.targetConversationId = rule.targetConversationId
    }
    if (containsAny(normalizedText, autoSendKeywords)) {
      patched.autoSendMessage = true
    }
    return patched
  }

  return llm
}

function matchMember(normalizedText, members, conversations) {
  if (!Array.isArray(members) || members.length === 0) return null
  const conversationByMember = new Map((conversations ?? []).map((c) => [c.memberId, c]))

  const candidates = members
    .filter((m) => m.role !== 'Elder')
    .map((m) => {
      const aliases = buildAliasesForMember(m)
      return {
        memberId: m.id,
        memberLabel: m.elderAlias || m.displayName || '家人',
        aliases,
        conversationId: conversationByMember.get(m.id)?.id ?? null,
      }
    })

  let best = null
  for (const c of candidates) {
    for (const alias of c.aliases) {
      if (!alias) continue
      if (normalizedText.includes(alias)) {
        if (!best || alias.length > best.aliasLen) {
          best = { ...c, aliasLen: alias.length }
        }
      }
    }
  }

  return best
}

function buildAliasesForMember(member) {
  const raw = [member.displayName, member.elderAlias]
  if (member.id === 'member_son') raw.push('儿子', '小儿子', '儿')
  if (member.id === 'member_daughter') raw.push('女儿', '闺女', '大女儿', '小女儿')

  if ((member.displayName || '').includes('儿')) raw.push('儿子')
  if ((member.displayName || '').includes('女')) raw.push('女儿')

  return Array.from(new Set(raw.filter(Boolean).map((x) => normalizeText(String(x)))))
}

function extractChatDraft(spokenText, aliases) {
  const aliasPatterns = (aliases || [])
    .filter((alias) => alias.length > 0)
    .map((alias) => escapeRegExp(alias))
    .join('|')

  const patterns = aliasPatterns
    ? [
        new RegExp(`(?:帮我)?(?:给|和|跟)?(?:${aliasPatterns})?(?:说|发|转告|回复|发消息|发信息)?`, 'gi'),
        /^(帮我|麻烦你|请你)/gi,
      ]
    : [/^(帮我|麻烦你|请你)/gi]

  let draft = spokenText
  patterns.forEach((pattern) => {
    draft = draft.replace(pattern, '')
  })

  return draft.replace(/[，。！？,.!?\s]+/g, ' ').trim()
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)))
}

function normalizeText(text) {
  return String(text ?? '').replace(/\s+/g, '').trim().toLowerCase()
}

function asText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function toNullableString(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tryParseJson(content) {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('LLM content is not valid JSON')
    return JSON.parse(match[0])
  }
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
