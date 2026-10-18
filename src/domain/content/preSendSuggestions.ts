import type {
  Message,
  PreSendSuggestion,
  PreSendSuggestionFramework,
  PreSendSuggestionScenario,
} from '../../services/api'

type BuildPreSendSuggestionParams = {
  draft: string
  messages: Message[]
}

type MessageContext = {
  latestPeerMessage: Message | null
  recentPeerMessages: Message[]
}

const LOW_INFO_EXACT_REPLIES = new Set([
  '食堂',
  '还行',
  '不错',
  '好',
  '挺好',
  '挺好的',
  '还好',
  '行',
  '行吧',
  '嗯',
  '嗯嗯',
  '嗯好',
  '好的',
  '好的呢',
  '收到',
  '知道了',
  '知道啦',
  '是的',
  '不是',
  '没事',
  '还可以',
  '一般',
  'ok',
  'yes',
  'received',
  'gotit',
])

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

const ANNOYED_REPEAT_KEYWORDS = [
  '烦不烦',
  '烦死了',
  '说了多少次',
  '说过多少次',
  '都说了',
  '不是说了',
  '不是跟你说过',
  '不是早就说了',
  '我都说了',
  '还要我说几遍',
  '还要说几次',
  '讲了多少次',
  '重复多少遍',
]

const DISMISSIVE_KEYWORDS = [
  '别问了',
  '别一直问',
  '别再问',
  '别老问',
  '别总问',
  '别烦我',
  '别啰嗦',
  '别磨叽',
  '别吵',
  '别闹',
  '别管了',
  '少说两句',
  '行了吧',
  '够了吧',
]

const BLAME_KEYWORDS = [
  '你怎么还',
  '你怎么又',
  '你到底',
  '你总是',
  '你老是',
  '怎么总是',
  '怎么老是',
  '你能不能',
  '能不能别',
  '你不会',
  '你都不',
  '你根本',
  '你自己看',
  '不是你',
]

const IMPATIENT_KEYWORDS = [
  '我很忙',
  '忙着呢',
  '忙死了',
  '没空',
  '没时间',
  '现在没空',
  '等会再说',
  '晚点再说',
  '先这样',
  '就这样吧',
]

const COMMANDING_KEYWORDS = [
  '赶紧',
  '立刻',
  '马上',
  '现在就',
  '赶快',
  '立马',
  '快点',
]

const RHETORICAL_PATTERNS = [
  '听不懂吗',
  '看不懂吗',
  '还不明白吗',
  '有必要吗',
  '至于吗',
  '非得这样吗',
  '有意思吗',
  '你这样有意思吗',
  '这样有意思吗',
  '你至于吗',
  '你有必要吗',
  '至于这样吗',
  '非要这样吗',
  '有完没完',
  '没完没了',
  '你到底想怎样',
  '你到底要干嘛',
]

const SHORT_NEGATIVE_TOKENS = [
  '烦',
  '气死',
  '受不了',
  '无语',
  '服了',
  '真服了',
  '真是',
  '离谱',
]

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

export function buildPreSendSuggestion({
  draft,
  messages,
}: BuildPreSendSuggestionParams): PreSendSuggestion | null {
  const trimmedDraft = draft.trim()
  if (!trimmedDraft) {
    return null
  }

  const normalizedDraft = normalizeText(trimmedDraft)
  const context = buildMessageContext(messages)

  const softenSuggestion = buildSoftenSuggestion(trimmedDraft, normalizedDraft)
  if (softenSuggestion) {
    return {
      ...softenSuggestion,
      triggerKey: `soften:${normalizedDraft}`,
    }
  }

  const followupSuggestion = buildFrameworkFollowupSuggestion(trimmedDraft, normalizedDraft, context)
  if (!followupSuggestion) {
    return null
  }

  return {
    ...followupSuggestion,
    triggerKey: buildFollowupTriggerKey(
      normalizedDraft,
      context.latestPeerMessage,
      followupSuggestion.scenario ?? 'ack_only',
    ),
  }
}

function buildSoftenSuggestion(draft: string, normalizedDraft: string): PreSendSuggestion | null {
  if (containsAny(normalizedDraft, ANNOYED_REPEAT_KEYWORDS)) {
    return softenResult([
      '这个我前面提过几次了，怕您一时没记住，我再跟您说一遍。',
      '这件事我之前说过，没关系，我现在再和您说清楚一点。',
    ])
  }

  if (containsAny(normalizedDraft, DISMISSIVE_KEYWORDS)) {
    return softenResult([
      '我这会儿可能有点着急，晚一点我再认真和您说。',
      '我先缓一下，等会儿我再好好跟您解释。',
    ])
  }

  if (containsAny(normalizedDraft, BLAME_KEYWORDS)) {
    return softenResult([
      toQuestionSoftenedDraft(draft),
      '我想先把情况确认清楚，再一起看看怎么处理更合适。',
    ])
  }

  if (containsAny(normalizedDraft, RHETORICAL_PATTERNS)) {
    return softenResult([
      '可能刚才我没说明白，我换个说法再和您讲一遍。',
      '没关系，我再说得慢一点，咱们一起确认一下。',
    ])
  }

  if (matchesShortNegativeTone(normalizedDraft)) {
    return softenResult([
      '我可能有点着急了，我换个更清楚的说法再和您讲一遍。',
      '没事，我再慢一点和您说，咱们一起确认一下。',
    ])
  }

  if (containsAny(normalizedDraft, IMPATIENT_KEYWORDS)) {
    return softenResult([
      '我现在手头有点忙，晚些我空下来再认真回您。',
      '我这会儿在忙，先跟您说一声，等会儿我再详细和您说。',
    ])
  }

  if (containsAny(normalizedDraft, COMMANDING_KEYWORDS)) {
    return softenResult([
      softenCommandDraft(draft),
      '如果方便的话，麻烦您尽快看一下，我这边有点着急。',
    ])
  }

  return null
}

function buildFrameworkFollowupSuggestion(
  draft: string,
  normalizedDraft: string,
  context: MessageContext,
): PreSendSuggestion | null {
  if (!isLikelyLowInformationReply(draft, normalizedDraft)) {
    return null
  }

  const scenario = classifyFollowupScenario(normalizedDraft, context)
  const framework = mapScenarioToFramework(scenario)
  const latestPeerText = getMessageText(context.latestPeerMessage)

  switch (scenario) {
    case 'emotion_missed':
      return followupResult({
        title: '这句回复有点短，先接住长辈情绪会更好',
        reason: '长辈刚才像是在表达感受或期待，先回应心情，再接一句安排，会更让人安心。',
        suggestions: [
          `${draft}，听起来您这会儿心里不太轻松，我晚点给您打个电话，好好听您说。`,
          `${draft}，我听出来您挺挂心这件事的，我忙完就来和您多聊几句。`,
        ],
        scenario,
        framework,
      })
    case 'question_dropped':
      return followupResult({
        title: '这句回复有点短，顺手把问题接住会更自然',
        reason: '长辈刚才是在等你回应，补一句具体情况或后续安排，聊天更容易继续。',
        suggestions: buildQuestionDroppedSuggestions(draft, latestPeerText),
        scenario,
        framework,
      })
    case 'status_short':
      return followupResult({
        title: '这句回复有点短，补一句近况会更容易接住',
        reason: '这类状态回复信息量偏少，顺手补一点事实和下一步，会更像在认真回应。',
        suggestions: buildStatusShortSuggestions(draft, latestPeerText),
        scenario,
        framework,
      })
    case 'ack_only':
    default:
      return followupResult({
        title: '可以顺手多回半句，让长辈更容易接住',
        reason: '这句回复已经表达收到，但再补一句理解或安排，会更有陪伴感。',
        suggestions: buildAckOnlySuggestions(draft, latestPeerText),
        scenario: 'ack_only',
        framework: mapScenarioToFramework('ack_only'),
      })
  }
}

function classifyFollowupScenario(normalizedDraft: string, context: MessageContext): PreSendSuggestionScenario {
  const latestPeerText = normalizeText(getMessageText(context.latestPeerMessage))
  const recentPeerText = context.recentPeerMessages.map((message) => normalizeText(getMessageText(message))).join(' ')

  if (looksEmotionalOrExpectant(latestPeerText) || looksEmotionalOrExpectant(recentPeerText)) {
    return 'emotion_missed'
  }

  if (isQuestionLike(latestPeerText)) {
    return 'question_dropped'
  }

  if (STATUS_SHORT_REPLIES.has(normalizedDraft) || looksLikeStatusReply(normalizedDraft)) {
    return 'status_short'
  }

  return 'ack_only'
}

function mapScenarioToFramework(scenario: PreSendSuggestionScenario): PreSendSuggestionFramework {
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

function buildAckOnlySuggestions(draft: string, latestPeerText: string) {
  if (looksLikePhotoContext(latestPeerText)) {
    return [
      `${draft}，我看到了，这张照片拍得真好，您今天是特意拍给我看的吗？`,
      `${draft}，我注意到了，照片里这个细节我一眼就看见了，您今天过得怎么样？`,
    ]
  }

  if (latestPeerText.includes('吃')) {
    return [
      `${draft}，我刚吃过了，您晚上吃得怎么样？`,
      `${draft}，我这边已经安排好了，您今天胃口还好吗？`,
    ]
  }

  return [
    `${draft}，我知道您刚才在说这件事了，我晚点再和您多聊几句。`,
    `${draft}，我看到了，等我忙完这阵就来跟您接着说。`,
  ]
}

function buildStatusShortSuggestions(draft: string, latestPeerText: string) {
  if (latestPeerText.includes('身体') || latestPeerText.includes('舒服') || latestPeerText.includes('怎么样')) {
    return [
      `${draft}，今天还算稳当，就是有点累，晚点我再跟您细说。`,
      `${draft}，目前都还好，我先把手头事情忙完，等会儿再和您多说两句。`,
    ]
  }

  return [
    `${draft}，今天整体还算顺利，晚一点我再跟您多说点。`,
    `${draft}，这会儿情况还算平稳，等我忙完再认真回您。`,
  ]
}

function buildQuestionDroppedSuggestions(draft: string, latestPeerText: string) {
  if (latestPeerText.includes('吃')) {
    return [
      `${draft}，我刚刚简单吃了点，您今天晚上吃了什么？`,
      `${draft}，我这边已经吃过了，您今天胃口怎么样？`,
    ]
  }

  if (latestPeerText.includes('忙')) {
    return [
      `${draft}，刚才确实有点忙，现在缓下来了，您这会儿在做什么呢？`,
      `${draft}，我刚忙完一阵，等下就能多聊会儿，您今天还顺利吗？`,
    ]
  }

  if (latestPeerText.includes('什么时候') || latestPeerText.includes('有空')) {
    return [
      `${draft}，我今天晚一点会空下来，到时候我给您回过去。`,
      `${draft}，我记着这件事了，等我忙完就和您确认时间。`,
    ]
  }

  return [
    `${draft}，我刚看到了，等我处理完这边就和您细说。`,
    `${draft}，我知道您是在问这件事，我晚点给您一个更完整的回复。`,
  ]
}

function softenResult(suggestions: string[]): PreSendSuggestion {
  return {
    shouldSuggest: true,
    type: 'soften',
    title: '这句话可能让对方更难接住',
    reason: '先把语气放缓一点，更容易把原意说清楚，也更不容易让对话变僵。',
    suggestions: uniqueSuggestions(suggestions),
    triggerKey: '',
  }
}

function followupResult({
  title,
  reason,
  suggestions,
  scenario,
  framework,
}: {
  title: string
  reason: string
  suggestions: string[]
  scenario: PreSendSuggestionScenario
  framework: PreSendSuggestionFramework
}): PreSendSuggestion {
  return {
    shouldSuggest: true,
    type: 'followup',
    title,
    reason,
    suggestions: uniqueSuggestions(suggestions),
    triggerKey: '',
    scenario,
    framework,
    sourceModel: 'fallback-local',
    confidence: 0.68,
  }
}

function buildMessageContext(messages: Message[]): MessageContext {
  const peerMessages = messages.filter((message) => message.senderType === 'Elder')
  return {
    latestPeerMessage: peerMessages.at(-1) ?? null,
    recentPeerMessages: peerMessages.slice(-3),
  }
}

function getMessageText(message: Message | null) {
  return `${message?.textContent ?? message?.transcript ?? ''}`.trim()
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').trim().toLowerCase()
}

function containsAny(normalizedText: string, keywords: string[]) {
  return keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)))
}

function matchesShortNegativeTone(normalizedText: string) {
  if (!containsAny(normalizedText, SHORT_NEGATIVE_TOKENS)) {
    return false
  }

  if (normalizedText.includes('麻烦')) {
    return false
  }

  return true
}

function isLikelyLowInformationReply(draft: string, normalizedDraft: string) {
  if (!draft.trim()) {
    return false
  }

  if (LOW_INFO_EXACT_REPLIES.has(normalizedDraft)) {
    return true
  }

  return draft.trim().length <= 4
}

function looksLikeStatusReply(normalizedDraft: string) {
  return normalizedDraft.endsWith('吧') || normalizedDraft.endsWith('呢') || normalizedDraft.endsWith('呀')
}

function isQuestionLike(normalizedText: string) {
  return (
    normalizedText.includes('？') ||
    normalizedText.includes('?') ||
    normalizedText.includes('吗') ||
    normalizedText.includes('呢') ||
    normalizedText.includes('啥') ||
    normalizedText.includes('什么') ||
    normalizedText.includes('怎么') ||
    normalizedText.includes('忙不忙') ||
    normalizedText.includes('有没有') ||
    normalizedText.includes('什么时候')
  )
}

function looksEmotionalOrExpectant(normalizedText: string) {
  return containsAny(normalizedText, EMOTION_KEYWORDS) || containsAny(normalizedText, EXPECTATION_KEYWORDS)
}

function looksLikePhotoContext(text: string) {
  return ['照片', '图片', '拍给你', '给你看', '拍的'].some((keyword) => text.includes(keyword))
}

function uniqueSuggestions(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 2)
}

function toQuestionSoftenedDraft(draft: string) {
  const softened = draft
    .replace(/你怎么/g, '是不是')
    .replace(/你到底/g, '是不是还')
    .replace(/你总是/g, '是不是经常')
    .replace(/你老是/g, '是不是总会')
    .replace(/怎么总是/g, '是不是经常会')
    .replace(/怎么老是/g, '是不是总会')
    .replace(/你能不能/g, '能不能')

  return `${softened}，我想先把情况确认清楚。`
}

function softenCommandDraft(draft: string) {
  return draft.replace(/赶紧|立刻|马上|现在就|赶快|立马|快点/g, '方便的话尽快')
}

function buildFollowupTriggerKey(
  normalizedDraft: string,
  latestPeerMessage: Message | null,
  scenario: PreSendSuggestionScenario,
) {
  return `followup:${scenario}:${normalizedDraft}:${latestPeerMessage?.id ?? 'none'}`
}
