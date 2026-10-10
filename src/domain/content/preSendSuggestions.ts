import type { Message, PreSendSuggestion } from '../../services/api'

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
  '还好',
  '行',
  '行吧',
  '嗯',
  '嗯嗯',
  '好的',
  '收到',
  '知道了',
  '是的',
  '不是',
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

  const followupSuggestion = buildFollowupSuggestion(trimmedDraft, normalizedDraft, context)
  if (followupSuggestion) {
    return {
      ...followupSuggestion,
      triggerKey: buildFollowupTriggerKey(normalizedDraft, context.latestPeerMessage),
    }
  }

  return null
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

function buildFollowupSuggestion(draft: string, normalizedDraft: string, context: MessageContext): PreSendSuggestion | null {
  if (!isLikelyLowInformationReply(draft, normalizedDraft)) {
    return null
  }

  const latestPeerMessage = context.latestPeerMessage
  if (!latestPeerMessage) {
    return followupResult(
      '可以顺手再接一句',
      '这条回复比较短，补半句近况或一个小问题，会更容易把聊天接下去。',
      [
        `${draft}，今天整体还算顺利。`,
        `${draft}，您那边今天怎么样？`,
      ],
    )
  }

  const peerText = `${latestPeerMessage.textContent ?? latestPeerMessage.transcript ?? ''}`.trim()
  const normalizedPeerText = normalizeText(peerText)

  if (latestPeerMessage.messageType === 'Image') {
    return followupResult(
      '可以顺手把话题接下去',
      '对方发来的是照片，补一句具体感受或追问细节，会比单独评价更容易继续聊。',
      [
        `${draft}，这张拍得真温馨，是今天拍的吗？`,
        `${draft}，我一眼就注意到里面的细节了，这是在哪儿拍的？`,
      ],
    )
  }

  if (isQuestionLike(normalizedPeerText)) {
    if (normalizedPeerText.includes('吃')) {
      return followupResult(
        '可以顺手多回半句',
        '对方在关心你的日常，补一点具体信息，再反问一句，聊天更容易延续。',
        [
          `${draft}，今天吃得还挺简单的，您晚上吃了什么？`,
          `${draft}，刚刚随便吃了点，您今天胃口怎么样？`,
        ],
      )
    }

    if (normalizedPeerText.includes('忙')) {
      return followupResult(
        '可以顺手多回半句',
        '对方在问你的状态，补一句近况会更自然，也更方便把话题接住。',
        [
          `${draft}，今天事情有点多，不过还算顺利，您今天过得怎么样？`,
          `${draft}，刚忙完一阵，您这会儿在做什么呢？`,
        ],
      )
    }

    return followupResult(
      '可以顺手多回半句',
      '对方是在发问，补一点具体信息，再反问一句，会更容易把聊天接下去。',
      [
        `${draft}，我这边还好，您那边怎么样？`,
        `${draft}，晚点我再和您细说，您今天还顺利吗？`,
      ],
    )
  }

  if (looksLikeDailyLifeContext(context.recentPeerMessages)) {
    return followupResult(
      '可以顺手再接一句',
      '这条回复比较短，补一句具体感受或近况，会更容易让聊天不断掉。',
      [
        `${draft}，今天整体还挺平稳的。`,
        `${draft}，我也想听听您那边的情况。`,
      ],
    )
  }

  return followupResult(
    '可以顺手再接一句',
    '这条回复信息量有点少，顺手补半句内容或一个问题，会更容易继续聊。',
    [
      `${draft}，我刚刚想到您了。`,
      `${draft}，您那边最近还好吗？`,
    ],
  )
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

function followupResult(title: string, reason: string, suggestions: string[]): PreSendSuggestion {
  return {
    shouldSuggest: true,
    type: 'followup',
    title,
    reason,
    suggestions: uniqueSuggestions(suggestions),
    triggerKey: '',
  }
}

function buildMessageContext(messages: Message[]): MessageContext {
  const peerMessages = messages.filter((message) => message.senderType === 'Elder')
  return {
    latestPeerMessage: peerMessages.at(-1) ?? null,
    recentPeerMessages: peerMessages.slice(-3),
  }
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

  // Exclude polite "麻烦..." usage, which often contains "烦" but is not hostile.
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

function isQuestionLike(normalizedText: string) {
  return (
    normalizedText.includes('？') ||
    normalizedText.includes('?') ||
    normalizedText.includes('吗') ||
    normalizedText.includes('呢') ||
    normalizedText.includes('啥') ||
    normalizedText.includes('什么') ||
    normalizedText.includes('怎么') ||
    normalizedText.includes('忙不忙')
  )
}

function looksLikeDailyLifeContext(messages: Message[]) {
  return messages.some((message) => {
    const normalized = normalizeText(`${message.textContent ?? message.transcript ?? ''}`)
    return ['今天', '刚刚', '回家', '吃饭', '照片', '最近', '身体'].some((keyword) => normalized.includes(keyword))
  })
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

function buildFollowupTriggerKey(normalizedDraft: string, latestPeerMessage: Message | null) {
  return `followup:${normalizedDraft}:${latestPeerMessage?.id ?? 'none'}`
}
