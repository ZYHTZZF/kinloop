import {
  LLM_API_KEY,
  LLM_BASE_URL,
  SUGGESTION_FAST_MODEL,
  SUGGESTION_ROUTING_MODE,
  SUGGESTION_STRONG_MODEL,
} from '../../config.mjs'

const REQUEST_TIMEOUT_MS = 35000

const ACK_ONLY_REPLIES = new Set([
  '嗯',
  '嗯嗯',
  '好的',
  '好的呢',
  '收到',
  '知道了',
  '知道啦',
  'ok',
  'yes',
  'received',
  'gotit',
])

const STATUS_SHORT_REPLIES = new Set([
  '还行',
  '不错',
  '好',
  '挺好',
  '挺好的',
  '还好',
  '行',
  '行吧',
  '没事',
  '还可以',
  '一般',
])

const LOW_INFO_EXACT_REPLIES = new Set([...ACK_ONLY_REPLIES, ...STATUS_SHORT_REPLIES, '食堂', '是的', '不是'])

const EMOTION_KEYWORDS = [
  '难受',
  '不舒服',
  '不开心',
  '心里堵',
  '委屈',
  '孤单',
  '想你',
  '想你们',
  '担心',
  '害怕',
  '睡不着',
  '累',
  '没劲',
  '不想动',
  '烦',
  '伤心',
  '难过',
  '失眠',
]

const EXPECTATION_KEYWORDS = [
  '你什么时候',
  '什么时候回来',
  '有空吗',
  '能不能',
  '要不要',
  '回我',
  '打电话',
  '陪我',
  '来看看',
  '想跟你说',
]

const FRAMEWORK_LABELS = {
  nvc: '非暴力沟通',
  xyz: 'XYZ 沟通法',
  fic: 'FIC 模型',
  deso: 'DESO 模型',
}

export function canUseSuggestionLlm() {
  return Boolean(LLM_API_KEY && (SUGGESTION_FAST_MODEL || SUGGESTION_STRONG_MODEL))
}

export function classifySuggestionScenario({ draft, messages }) {
  const trimmedDraft = `${draft ?? ''}`.trim()
  const normalizedDraft = normalizeText(trimmedDraft)
  if (!trimmedDraft || !isLikelyLowInformationReply(trimmedDraft, normalizedDraft)) {
    return null
  }

  const context = buildMessageContext(messages)
  const latestPeerText = normalizeText(getMessageText(context.latestPeerMessage))
  const recentPeerText = context.recentPeerMessages.map((message) => normalizeText(getMessageText(message))).join(' ')

  let scenario = 'ack_only'
  if (looksEmotionalOrExpectant(latestPeerText) || looksEmotionalOrExpectant(recentPeerText)) {
    scenario = 'emotion_missed'
  } else if (isQuestionLike(latestPeerText)) {
    scenario = 'question_dropped'
  } else if (STATUS_SHORT_REPLIES.has(normalizedDraft) || looksLikeStatusReply(normalizedDraft)) {
    scenario = 'status_short'
  }

  const framework = mapScenarioToFramework(scenario)
  const confidence = buildScenarioConfidence(scenario, latestPeerText, recentPeerText)
  const escalateModel = shouldEscalateModel({ scenario, context, recentPeerText })

  return {
    scenario,
    framework,
    confidence,
    escalateModel,
    context,
  }
}

export function selectSuggestionModel({ scenario, escalateModel }) {
  const routingMode = normalizeRoutingMode(SUGGESTION_ROUTING_MODE)

  if (routingMode === 'quality') {
    return SUGGESTION_STRONG_MODEL || SUGGESTION_FAST_MODEL || ''
  }

  if (routingMode === 'balanced') {
    if (scenario === 'emotion_missed' || scenario === 'question_dropped') {
      return SUGGESTION_STRONG_MODEL || SUGGESTION_FAST_MODEL || ''
    }
    return SUGGESTION_FAST_MODEL || SUGGESTION_STRONG_MODEL || ''
  }

  if (scenario === 'emotion_missed' || escalateModel) {
    return SUGGESTION_STRONG_MODEL || SUGGESTION_FAST_MODEL || ''
  }

  return SUGGESTION_FAST_MODEL || SUGGESTION_STRONG_MODEL || ''
}

export function buildSuggestionPrompt({ draft, messages, classification }) {
  const latestPeerMessage = classification.context.latestPeerMessage
  const recentContext = classification.context.recentPeerMessages.map((message) => ({
    id: message.id,
    messageType: message.messageType,
    text: getMessageText(message),
    createdAt: message.createdAt,
  }))

  const systemPrompt = [
    '你是家人端的中文回复建议助手，专门帮助子女在和长辈聊天时，把过短、过敷衍的回复补得更有接住感。',
    `当前场景：${classification.scenario}。`,
    `本次必须使用的沟通框架：${FRAMEWORK_LABELS[classification.framework]}。`,
    buildFrameworkInstruction(classification.framework),
    '只处理“敷衍续聊”场景，不要把普通短句上升为冲突。',
    '输出必须是严格 JSON，不要输出 markdown。',
    'JSON 字段必须包含：shouldSuggest,type,title,reason,suggestions,scenario,framework,confidence。',
    'type 必须是 followup。',
    'suggestions 必须是 1 到 2 条可直接发送的简短中文。',
    '不要输出框架名给用户，不要说教，不要评判，不要夸张，不要出现“作为子女”“建议你”。',
    '建议要承接长辈上一条内容，保留原回复意图，但把内容补得更完整。',
  ].join('\n')

  const userPrompt = JSON.stringify({
    draft,
    latestPeerMessage: latestPeerMessage
      ? {
          id: latestPeerMessage.id,
          messageType: latestPeerMessage.messageType,
          text: getMessageText(latestPeerMessage),
          createdAt: latestPeerMessage.createdAt,
        }
      : null,
    recentContext,
    scenario: classification.scenario,
    framework: classification.framework,
  })

  return { systemPrompt, userPrompt }
}

export async function generateSuggestionWithLlm({ draft, messages, classification }) {
  const model = selectSuggestionModel(classification)
  if (!LLM_API_KEY || !model) {
    return null
  }

  const { systemPrompt, userPrompt } = buildSuggestionPrompt({ draft, messages, classification })
  const payload = {
    model,
    temperature: 0.35,
    max_tokens: 220,
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

  return sanitizePreSendSuggestion({
    result: parsed,
    classification,
    draft,
    model,
  })
}

export function sanitizePreSendSuggestion({ result, classification, draft, model }) {
  if (!result || typeof result !== 'object') {
    return null
  }

  const title = asText(result.title) || fallbackTitle(classification.scenario)
  const reason = asText(result.reason) || fallbackReason(classification.scenario)
  const suggestions = Array.isArray(result.suggestions)
    ? result.suggestions.map((item) => asText(item)).filter(Boolean).slice(0, 2)
    : []
  const normalizedDraft = normalizeText(draft)
  const triggerKey = asText(result.triggerKey)
    || buildFollowupTriggerKey(normalizedDraft, classification.context.latestPeerMessage, classification.scenario)

  if (!title || !reason || suggestions.length === 0) {
    return null
  }

  return {
    shouldSuggest: true,
    type: 'followup',
    title,
    reason,
    suggestions,
    triggerKey,
    scenario: classification.scenario,
    framework: classification.framework,
    sourceModel: model,
    confidence: clampConfidence(result.confidence, classification.confidence),
  }
}

function buildFrameworkInstruction(framework) {
  switch (framework) {
    case 'nvc':
      return '非暴力沟通要求：先回应对方可能的感受或需要，再给出自己的回应和下一步。'
    case 'fic':
      return 'FIC 要求：补充一个简短事实，再说明当前影响或状态，最后给出一个轻量后续。'
    case 'deso':
      return 'DESO 要求：明确回应对方的问题或请求，给出可执行安排，不要生硬划界。'
    case 'xyz':
    default:
      return 'XYZ 要求：围绕“我看到你在说什么 / 我理解到了什么 / 我接下来怎么回应”来组织回复。'
  }
}

function mapScenarioToFramework(scenario) {
  switch (scenario) {
    case 'emotion_missed':
      return 'nvc'
    case 'question_dropped':
      return 'deso'
    case 'status_short':
      return 'fic'
    case 'ack_only':
    default:
      return 'xyz'
  }
}

function buildScenarioConfidence(scenario, latestPeerText, recentPeerText) {
  if (scenario === 'emotion_missed' && (looksEmotionalOrExpectant(latestPeerText) || looksEmotionalOrExpectant(recentPeerText))) {
    return 0.9
  }
  if (scenario === 'question_dropped' && isQuestionLike(latestPeerText)) {
    return 0.86
  }
  if (scenario === 'status_short') {
    return 0.8
  }
  return 0.74
}

function shouldEscalateModel({ scenario, context, recentPeerText }) {
  if (scenario === 'emotion_missed') {
    return true
  }

  if (context.recentPeerMessages.some((message) => message.messageType === 'Voice' && message.transcript)) {
    return true
  }

  if (looksEmotionalOrExpectant(recentPeerText) && context.recentPeerMessages.length >= 2) {
    return true
  }

  return false
}

function normalizeRoutingMode(value) {
  const mode = `${value ?? ''}`.trim().toLowerCase()
  if (mode === 'quality' || mode === 'balanced') {
    return mode
  }
  return 'speed'
}

function buildMessageContext(messages) {
  const peerMessages = Array.isArray(messages) ? messages.filter((message) => message?.senderType === 'Elder').slice(-5) : []
  return {
    latestPeerMessage: peerMessages.at(-1) ?? null,
    recentPeerMessages: peerMessages.slice(-3),
  }
}

function getMessageText(message) {
  return `${message?.textContent ?? message?.transcript ?? ''}`.trim()
}

function normalizeText(value) {
  return `${value ?? ''}`.replace(/\s+/g, '').trim().toLowerCase()
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isLikelyLowInformationReply(draft, normalizedDraft) {
  if (!draft.trim()) {
    return false
  }

  if (LOW_INFO_EXACT_REPLIES.has(normalizedDraft)) {
    return true
  }

  return draft.trim().length <= 4
}

function looksLikeStatusReply(normalizedDraft) {
  return normalizedDraft.endsWith('吧') || normalizedDraft.endsWith('呢') || normalizedDraft.endsWith('呀')
}

function isQuestionLike(normalizedText) {
  return (
    normalizedText.includes('？')
    || normalizedText.includes('?')
    || normalizedText.includes('吗')
    || normalizedText.includes('呢')
    || normalizedText.includes('啥')
    || normalizedText.includes('什么')
    || normalizedText.includes('怎么')
    || normalizedText.includes('忙不忙')
    || normalizedText.includes('有没有')
    || normalizedText.includes('什么时候')
  )
}

function looksEmotionalOrExpectant(normalizedText) {
  return containsAny(normalizedText, EMOTION_KEYWORDS) || containsAny(normalizedText, EXPECTATION_KEYWORDS)
}

function containsAny(normalizedText, keywords) {
  return keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)))
}

function fallbackTitle(scenario) {
  switch (scenario) {
    case 'emotion_missed':
      return '这句回复有点短，先接住长辈情绪会更好'
    case 'question_dropped':
      return '这句回复有点短，顺手把问题接住会更自然'
    case 'status_short':
      return '这句回复有点短，补一句近况会更容易接住'
    case 'ack_only':
    default:
      return '可以顺手多回半句，让长辈更容易接住'
  }
}

function fallbackReason(scenario) {
  switch (scenario) {
    case 'emotion_missed':
      return '长辈刚才像是在表达感受或期待，先回应心情，再接一句安排，会更让人安心。'
    case 'question_dropped':
      return '长辈刚才是在等你回应，补一句具体情况或后续安排，聊天更容易继续。'
    case 'status_short':
      return '这类状态回复信息量偏少，顺手补一点事实和下一步，会更像在认真回应。'
    case 'ack_only':
    default:
      return '这句回复已经表达收到，但再补一句理解或安排，会更有陪伴感。'
  }
}

function buildFollowupTriggerKey(normalizedDraft, latestPeerMessage, scenario) {
  return `followup:${scenario}:${normalizedDraft}:${latestPeerMessage?.id ?? 'none'}`
}

function clampConfidence(value, fallback) {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 1) {
    return numeric
  }
  return fallback
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
