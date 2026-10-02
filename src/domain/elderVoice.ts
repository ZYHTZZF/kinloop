import type { ConversationCard, Member } from '../services/api'

export type ElderIntentType = 'companion' | 'chat' | 'support' | 'memory' | 'clarify'
export type ElderUrgencyLevel = 'none' | 'normal' | 'attention' | 'emergency'
export type ElderNextAction =
  | 'stay'
  | 'open_conversation'
  | 'trigger_alert'
  | 'save_memory'
  | 'open_memories'
  | 'clarify'

export type ElderMemoryAction = 'save_note' | 'open_memory' | null

export type ElderVoiceIntentResult = {
  spokenText: string
  normalizedText: string
  intentType: ElderIntentType
  targetMemberId: string | null
  targetMemberLabel: string | null
  targetConversationId: string | null
  confidence: number
  requiresConfirmation: boolean
  nextAction: ElderNextAction
  urgencyLevel: ElderUrgencyLevel
  memoryAction: ElderMemoryAction
  promptTitle: string
  promptBody: string
  confirmLabel: string
  draftText: string
  autoSendMessage?: boolean
}

type MemberAlias = {
  memberId: string
  memberLabel: string
  conversationId: string | null
  aliases: string[]
}

const emergencyKeywords = ['救命', '快来', '出大事', '摔倒', '胸口疼', '喘不上气', '站不起来', '急救']
const supportKeywords = ['不舒服', '难受', '头晕', '心慌', '疼', '帮帮我', '联系家人', '找人来', '身体']
const memoryKeywords = ['记下来', '记住', '留着', '回忆', '照片', '相片', '那张图', '那张照片']
const openMemoryKeywords = ['想看看', '再看看', '翻出来', '昨天那张照片', '以前那张照片']
const chatTriggers = ['跟', '给', '告诉', '发给', '转给', '找', '联系', '说给']
const questionKeywords = ['吗', '么', '呢', '是不是', '会不会', '能不能', '要不要', '回不回来', '什么时候', '几点', '去哪', '吃不吃']
const companionKeywords = ['想说说话', '想聊聊', '想你们', '睡不着', '没精神', '心里空', '想念', '唠唠']

export function classifyElderSpeech(
  spokenText: string,
  members: Member[],
  conversations: ConversationCard[],
): ElderVoiceIntentResult {
  const normalizedText = normalizeText(spokenText)
  const aliases = buildMemberAliases(members, conversations)
  const matchedMember = findMatchedMember(normalizedText, aliases)

  if (!normalizedText) {
    return clarifyResult(spokenText, '我还没听清这句话', '再说完整一点，我就能帮你分过去。')
  }

  if (containsAny(normalizedText, emergencyKeywords)) {
    return {
      spokenText,
      normalizedText,
      intentType: 'support',
      targetMemberId: matchedMember?.memberId ?? null,
      targetMemberLabel: matchedMember?.memberLabel ?? '家人',
      targetConversationId: matchedMember?.conversationId ?? null,
      confidence: 0.98,
      requiresConfirmation: false,
      nextAction: 'trigger_alert',
      urgencyLevel: 'emergency',
      memoryAction: null,
      promptTitle: '我听到这是紧急情况',
      promptBody: '我会立刻通知家人，并把这次求助提到最优先。',
      confirmLabel: '立即通知',
      draftText: '',
    }
  }

  if (containsAny(normalizedText, openMemoryKeywords)) {
    return {
      spokenText,
      normalizedText,
      intentType: 'memory',
      targetMemberId: matchedMember?.memberId ?? null,
      targetMemberLabel: matchedMember?.memberLabel ?? null,
      targetConversationId: matchedMember?.conversationId ?? null,
      confidence: 0.86,
      requiresConfirmation: false,
      nextAction: 'open_memories',
      urgencyLevel: 'none',
      memoryAction: 'open_memory',
      promptTitle: '我听出来你想翻翻之前的内容',
      promptBody: '我这就带你去回忆里看看最近留住的照片和话。',
      confirmLabel: '去看看',
      draftText: '',
    }
  }

  if (containsAny(normalizedText, memoryKeywords)) {
    return {
      spokenText,
      normalizedText,
      intentType: 'memory',
      targetMemberId: matchedMember?.memberId ?? null,
      targetMemberLabel: matchedMember?.memberLabel ?? null,
      targetConversationId: matchedMember?.conversationId ?? null,
      confidence: 0.91,
      requiresConfirmation: true,
      nextAction: 'save_memory',
      urgencyLevel: 'none',
      memoryAction: 'save_note',
      promptTitle: '这句话像是想帮你记下来',
      promptBody: '我可以把它放进回忆里，之后你和家人都能再翻出来看。',
      confirmLabel: '帮我记下',
      draftText: extractMemoryNote(spokenText),
    }
  }

  if (
    matchedMember &&
    (
      containsAny(normalizedText, chatTriggers) ||
      containsAny(normalizedText, questionKeywords) ||
      normalizedText.includes(normalizeText(matchedMember.memberLabel))
    )
  ) {
    return {
      spokenText,
      normalizedText,
      intentType: 'chat',
      targetMemberId: matchedMember.memberId,
      targetMemberLabel: matchedMember.memberLabel,
      targetConversationId: matchedMember.conversationId,
      confidence: matchedMember.aliases.some((alias) => normalizedText.includes(alias)) ? 0.93 : 0.72,
      requiresConfirmation: true,
      nextAction: 'open_conversation',
      urgencyLevel: 'none',
      memoryAction: null,
      promptTitle: `我听出来你想找${matchedMember.memberLabel}`,
      promptBody: `我可以帮你打开和${matchedMember.memberLabel}的对话，再把想说的话整理好。`,
      confirmLabel: `打开${matchedMember.memberLabel}`,
      draftText: extractChatDraft(spokenText, matchedMember.aliases),
    }
  }

  if (containsAny(normalizedText, supportKeywords)) {
    return {
      spokenText,
      normalizedText,
      intentType: 'support',
      targetMemberId: matchedMember?.memberId ?? null,
      targetMemberLabel: matchedMember?.memberLabel ?? '家人',
      targetConversationId: matchedMember?.conversationId ?? null,
      confidence: 0.88,
      requiresConfirmation: true,
      nextAction: 'trigger_alert',
      urgencyLevel: normalizedText.includes('马上') || normalizedText.includes('赶紧') ? 'attention' : 'normal',
      memoryAction: null,
      promptTitle: '我听到你现在需要人来照应',
      promptBody: '如果你愿意，我现在就通知家人，请他们尽快接住这件事。',
      confirmLabel: '通知家人',
      draftText: '',
    }
  }

  if (containsAny(normalizedText, companionKeywords) || normalizedText.length >= 6) {
    return {
      spokenText,
      normalizedText,
      intentType: 'companion',
      targetMemberId: null,
      targetMemberLabel: null,
      targetConversationId: null,
      confidence: 0.77,
      requiresConfirmation: false,
      nextAction: 'stay',
      urgencyLevel: 'none',
      memoryAction: null,
      promptTitle: '你像是想先说说话',
      promptBody: '我先在这里陪着你。要是你想转给家人，等会儿我也能继续帮你整理。',
      confirmLabel: '继续说',
      draftText: '',
    }
  }

  return clarifyResult(
    spokenText,
    '我还想再确认一下',
    '你是想联系家人、需要帮助，还是想让我先陪你说说？',
  )
}

function clarifyResult(spokenText: string, promptTitle: string, promptBody: string): ElderVoiceIntentResult {
  return {
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
    promptTitle,
    promptBody,
    confirmLabel: '再说一次',
    draftText: '',
  }
}

function buildMemberAliases(members: Member[], conversations: ConversationCard[]): MemberAlias[] {
  return members
    .filter((member) => member.role !== 'Elder')
    .map((member) => {
      const conversation = conversations.find((item) => item.memberId === member.id)
      const aliases = new Set<string>([
        member.displayName,
        member.elderAlias ?? '',
        member.displayName.replace('大', ''),
        member.displayName.replace('小', ''),
      ])

      if (member.id === 'member_daughter') {
        ;['女儿', '闺女', '大女儿', '姑娘', '老大'].forEach((alias) => aliases.add(alias))
      }

      if (member.id === 'member_son') {
        ;['儿子', '小儿子', '儿', '小子'].forEach((alias) => aliases.add(alias))
      }

      return {
        memberId: member.id,
        memberLabel: member.elderAlias ?? member.displayName,
        conversationId: conversation?.id ?? null,
        aliases: Array.from(aliases).filter(Boolean).map((alias) => normalizeText(alias)),
      }
    })
}

function findMatchedMember(normalizedText: string, aliases: MemberAlias[]) {
  return aliases.find((member) => member.aliases.some((alias) => normalizedText.includes(alias)))
}

function extractChatDraft(spokenText: string, aliases: string[]) {
  const aliasPatterns = aliases
    .filter((alias) => alias.length > 0)
    .map((alias) => escapeRegExp(alias))
    .join('|')

  const patterns = aliasPatterns
    ? [
        new RegExp(`(?:帮我)?(?:跟|给|和|告诉|发给|转给)?(?:${aliasPatterns})?(?:说一声|说句话|说|讲一句|带句话)?`, 'g'),
        /^(帮我|麻烦你|请你)/g,
      ]
    : [/^(帮我|麻烦你|请你)/g]

  let draft = spokenText
  patterns.forEach((pattern) => {
    draft = draft.replace(pattern, '')
  })

  return draft.replace(/[，。！？,.!?\s]+/g, ' ').trim()
}

function extractMemoryNote(spokenText: string) {
  return spokenText
    .replace(/帮我(把)?/g, '')
    .replace(/记下来|记住|留着|留起来/g, '')
    .replace(/[，。！？,.!?]/g, ' ')
    .trim()
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').trim().toLowerCase()
}

function containsAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)))
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
