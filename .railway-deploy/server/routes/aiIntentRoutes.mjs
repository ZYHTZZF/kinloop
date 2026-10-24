import { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL } from '../config.mjs'

const INTENT_TYPES = ['companion', 'chat', 'support', 'memory', 'clarify']
const NEXT_ACTIONS = ['stay', 'open_conversation', 'trigger_alert', 'save_memory', 'open_memories', 'clarify']
const URGENCY_LEVELS = ['none', 'normal', 'attention', 'emergency']
const MEMORY_ACTIONS = ['save_note', 'open_memory', null]

const REQUEST_TIMEOUT_MS = 35000
const MAX_ATTEMPTS = 1

const emergencyKeywords = ['救命', '救我', '胸口痛', '胸口很痛', '喘不上气', '摔倒', '晕倒', '快来', '急救', '危险', '120']
const supportKeywords = ['不舒服', '难受', '疼', '头晕', '心慌', '帮帮我', '联系家人']
const memorySaveKeywords = ['记一下', '记下来', '记住', '帮我记', '记到回忆']
const memoryOpenKeywords = ['看看照片', '翻照片', '相册', '回忆', '以前的照片', '之前的照片']
const companionKeywords = ['聊聊天', '陪我聊', '陪我说说话', '说说话', '陪陪我', '解解闷']
const questionKeywords = ['什么时候', '几点', '哪里', '为什么', '怎么', '多少', '是不是', '能不能', '?', '？']
const chatKeywords = ['聊天', '联系', '发消息', '发信息', '发送', '发给', '告诉', '转告', '回复', '打开']
const autoSendKeywords = ['发给', '发消息', '发信息', '发送', '转告', '告诉', '回复', '带句话', '并发', '发我', '发条消息', '讲一声', '说一声']

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
        res.json({ ok: true, result: ruleResult })
        return
      }

      try {
        const aiResult = await inferElderIntentWithLlm({ spokenText, members, conversations })
        const sanitized = sanitizeIntent(aiResult, spokenText)
        const merged = mergeRuleGuard(sanitized, ruleResult)
        const finalized = postProcessForPrecision(merged, spokenText, members, conversations, ruleResult)
        res.json({ ok: true, result: finalized })
      } catch (llmError) {
        const message = llmError instanceof Error ? llmError.message : String(llmError)
        console.warn(`[AI Intent] fallback to local rules: ${message}`)
        res.json({ ok: true, result: ruleResult })
      }
    } catch (error) {
      console.error('[AI Intent] request failed:', error)
      res.status(500).json({ error: 'AI intent parsing failed' })
    }
  })
}

async function inferElderIntentWithLlm({ spokenText, members, conversations }) {
  const systemPrompt = [
    'You are an intent parser for a Chinese elderly family-care assistant.',
    'Return strict JSON only. No markdown. No extra keys.',
    'Goal: one-shot operation. Prefer decisive routing over unclear clarify.',
    'Rules:',
    '1) If user expresses emergency symptoms, use nextAction=trigger_alert and urgencyLevel=emergency.',
    '2) If user asks to contact/chat/send to a family member, use intentType=chat and nextAction=open_conversation.',
    '3) If user explicitly asks to send/tell/forward a message, set autoSendMessage=true and provide draftText with command words removed.',
    '4) Use clarify only if target/action is truly ambiguous.',
    '5) targetMemberId must come from provided members; targetConversationId must come from provided conversations when possible.',
  ].join(' ')

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
        memoryAction: MEMORY_ACTIONS,
        confidence: 'number(0~1)',
        requiresConfirmation: 'boolean',
        targetMemberId: 'string|null',
        targetMemberLabel: 'string|null',
        targetConversationId: 'string|null',
        assistantReply: 'string',
        promptTitle: 'string',
        promptBody: 'string',
        confirmLabel: 'string',
        draftText: 'string',
        autoSendMessage: 'boolean',
      },
      examples: [
        {
          spokenText: '帮我给女儿发条消息，今晚回来吃饭吗',
          expected: {
            intentType: 'chat',
            nextAction: 'open_conversation',
            targetMemberLabel: '女儿',
            autoSendMessage: true,
            draftText: '今晚回来吃饭吗',
          },
        },
        {
          spokenText: '我胸口很痛，快联系家人',
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
      const payloadWithJsonObject = {
        model: LLM_MODEL,
        temperature: 0,
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
          body: JSON.stringify(payloadWithJsonObject),
        },
        REQUEST_TIMEOUT_MS,
      )

      if (!response.ok && response.status === 400) {
        const text = await safeText(response)
        const unsupportedJsonObject = /response_format|json_object/i.test(text)
        if (unsupportedJsonObject) {
          response = await fetchWithTimeout(
            `${LLM_BASE_URL}/chat/completions`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${LLM_API_KEY}`,
              },
              body: JSON.stringify({
                model: LLM_MODEL,
                temperature: 0,
                messages: payloadWithJsonObject.messages,
              }),
            },
            REQUEST_TIMEOUT_MS,
          )
        } else {
          throw new Error(`LLM HTTP 400: ${text}`)
        }
      }

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
    assistantReply: '我在听，你可以继续说，我会尽量直接帮你处理。',
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
    assistantReply: asText(raw.assistantReply, fallback.assistantReply),
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
    assistantReply: '我在听，你可以继续说，我会尽量直接帮你处理。',
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
      promptTitle: '我听出来这是紧急情况',
      promptBody: '我会立刻通知家人并优先处理。',
      assistantReply: '我马上帮你联系家人，先别着急。',
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
      assistantReply: '好的，我这就帮你打开回忆内容。',
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
      assistantReply: '好的，我帮你记下来了。',
      confirmLabel: '帮我记下',
      draftText: spokenText,
      targetMemberId: target?.memberId ?? null,
      targetMemberLabel: target?.memberLabel ?? null,
      targetConversationId: target?.conversationId ?? null,
    }
  }

  const hasChatSignal = containsAny(normalizedText, chatKeywords) || hasChatRegexSignal(normalizedText)
  const hasTarget = Boolean(target)
  if (hasTarget && hasChatSignal) {
    const autoSend = containsAny(normalizedText, autoSendKeywords) || hasAutoSendRegexSignal(normalizedText)
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
      assistantReply: `好的，我来帮你联系${target.memberLabel}。`,
      confirmLabel: `打开${target.memberLabel}`,
      draftText: cleanDraftForSend(spokenText, target.aliases),
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
      assistantReply: '我来帮你联系家人，请稍等一下。',
      confirmLabel: '通知家人',
    }
  }

  if (containsAny(normalizedText, questionKeywords)) {
    return {
      ...fallback,
      intentType: 'companion',
      nextAction: 'stay',
      confidence: 0.72,
      promptTitle: '我来回答你这个问题',
      promptBody: '你可以继续问我，我会尽量用简单的话回答。',
      assistantReply: '我来回答你这个问题，你还可以继续问我。',
      confirmLabel: '继续聊',
    }
  }

  if (containsAny(normalizedText, companionKeywords)) {
    return {
      ...fallback,
      intentType: 'companion',
      nextAction: 'stay',
      confidence: 0.88,
      promptTitle: '我在这儿陪你聊聊',
      promptBody: '你想聊什么，我都在这儿听你说。',
      assistantReply: '我在呢，你想聊什么都可以和我说。',
      confirmLabel: '继续聊',
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

  const merged = { ...llm }

  if (merged.nextAction === 'open_conversation' && merged.targetMemberId && !merged.targetConversationId) {
    if (rule.targetMemberId === merged.targetMemberId && rule.targetConversationId) {
      merged.targetConversationId = rule.targetConversationId
    }
  }

  return merged
}

function postProcessForPrecision(result, spokenText, members, conversations, ruleResult) {
  const normalizedText = normalizeText(spokenText)
  const merged = { ...result }

  const targetById = (members || []).find((member) => member?.id === merged.targetMemberId) ?? null
  const targetByLabel = !targetById && merged.targetMemberLabel
    ? matchMemberByLabel(merged.targetMemberLabel, members, conversations)
    : null
  const inferredTarget = targetById || targetByLabel || matchMember(normalizedText, members, conversations)

  if (merged.nextAction === 'open_conversation' && !merged.targetMemberId && inferredTarget) {
    merged.targetMemberId = inferredTarget.memberId
    merged.targetMemberLabel = merged.targetMemberLabel || inferredTarget.memberLabel
    merged.targetConversationId = merged.targetConversationId || inferredTarget.conversationId || null
  }

  if (merged.nextAction === 'open_conversation' && merged.targetMemberId && !merged.targetConversationId) {
    const conversation = (conversations || []).find((item) => item?.memberId === merged.targetMemberId)
    merged.targetConversationId = conversation?.id ?? merged.targetConversationId
  }

  if (merged.nextAction === 'open_conversation') {
    merged.autoSendMessage = Boolean(
      merged.autoSendMessage || containsAny(normalizedText, autoSendKeywords) || hasAutoSendRegexSignal(normalizedText),
    )
    merged.draftText = cleanDraftForSend(merged.draftText || spokenText, inferredTarget?.aliases || [])
  }

  if (!merged.assistantReply || !String(merged.assistantReply).trim()) {
    merged.assistantReply = merged.promptBody || merged.promptTitle || '好的，我知道了。'
  }

  if (merged.nextAction !== 'clarify' && merged.promptTitle === '我还想再确认一下') {
    if (merged.nextAction === 'open_conversation') merged.promptTitle = '我来帮你联系家人'
    if (merged.nextAction === 'trigger_alert') merged.promptTitle = '我马上帮你发起求助'
    if (merged.nextAction === 'open_memories') merged.promptTitle = '我来帮你打开回忆内容'
    if (merged.nextAction === 'save_memory') merged.promptTitle = '我来帮你记下来'
    if (merged.nextAction === 'stay') merged.promptTitle = '我来回答你'
  }

  const actionable = isClearlyActionable(normalizedText)
  if (merged.nextAction === 'clarify' && actionable && ruleResult.nextAction !== 'clarify') {
    return {
      ...ruleResult,
      confidence: Math.max(0.82, merged.confidence || 0),
    }
  }

  return merged
}

function isClearlyActionable(normalizedText) {
  return (
    containsAny(normalizedText, emergencyKeywords) ||
    containsAny(normalizedText, supportKeywords) ||
    containsAny(normalizedText, chatKeywords) ||
    hasChatRegexSignal(normalizedText) ||
    containsAny(normalizedText, memorySaveKeywords) ||
    containsAny(normalizedText, memoryOpenKeywords)
  )
}

function matchMember(normalizedText, members, conversations) {
  if (!Array.isArray(members) || members.length === 0) return null
  const conversationByMember = new Map((conversations ?? []).map((conversation) => [conversation.memberId, conversation]))

  const candidates = members
    .filter((member) => member.role !== 'Elder' && member.role !== 'AI')
    .map((member) => {
      const aliases = buildAliasesForMember(member)
      return {
        memberId: member.id,
        memberLabel: member.elderAlias || member.displayName || '家人',
        aliases,
        conversationId: conversationByMember.get(member.id)?.id ?? null,
      }
    })

  let best = null
  for (const candidate of candidates) {
    for (const alias of candidate.aliases) {
      if (!alias) continue
      if (normalizedText.includes(alias)) {
        if (!best || alias.length > best.aliasLen) {
          best = { ...candidate, aliasLen: alias.length }
        }
      }
    }
  }

  return best
}

function matchMemberByLabel(targetMemberLabel, members, conversations) {
  const normalizedLabel = normalizeText(targetMemberLabel)
  if (!normalizedLabel) return null

  return matchMember(normalizedLabel, members, conversations)
}

function buildAliasesForMember(member) {
  const raw = [member.displayName, member.elderAlias]
  if (member.id === 'member_son') raw.push('儿子', '小儿子', '孩子', '儿')
  if (member.id === 'member_daughter') raw.push('女儿', '闺女', '大女儿', '小女儿', '姑娘')

  if ((member.displayName || '').includes('儿')) raw.push('儿子')
  if ((member.displayName || '').includes('女')) raw.push('女儿')

  return Array.from(new Set(raw.filter(Boolean).map((value) => normalizeText(String(value)))))
}

function cleanDraftForSend(input, aliases) {
  let draft = String(input ?? '')

  const aliasPatterns = (aliases || [])
    .filter((alias) => alias.length > 0)
    .map((alias) => escapeRegExp(alias))
    .join('|')

  const headPattern = aliasPatterns
    ? new RegExp(`^(?:帮我|麻烦你|请你)?(?:给|跟|和)?(?:${aliasPatterns})?(?:发.{0,2}(?:消息|信息)|发送|转告|告诉|回复)?[，。:：\\s]*`, 'i')
    : /^(?:帮我|麻烦你|请你)?(?:给|跟|和)?(?:发.{0,2}(?:消息|信息)|发送|转告|告诉|回复)?[，。:：\s]*/i

  draft = draft.replace(headPattern, '')
  draft = draft.replace(/^(?:请)?(?:替我|帮我)?(?:跟|和)?(?:[^，。！？\s]{1,8})?(?:讲一声|说一声|带句话)[，。:：\s]*/i, '')
  draft = draft.replace(/^(?:帮我|麻烦你|请你)[，。:：\s]*/i, '')
  draft = draft.replace(/[，。！？!?.]+/g, ' ').replace(/\s+/g, ' ').trim()

  if (!draft) {
    return String(input ?? '').replace(/[，。！？!?.]+/g, ' ').replace(/\s+/g, ' ').trim()
  }

  return draft
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)))
}

function hasChatRegexSignal(text) {
  return /(聊天|联系|打开|发.{0,2}(消息|信息)|发送|发给|告诉|转告|回复|讲一声|说一声|替我跟)/.test(text)
}

function hasAutoSendRegexSignal(text) {
  return /(发.{0,2}(消息|信息)|发送|发给|转告|告诉|回复|带句话|并发|发我|讲一声|说一声|替我跟)/.test(text)
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
