export type FamilySpace = {
  id: string
  name: string
  elderDisplayName: string
  primaryMemberId: string
  createdAt: number
  updatedAt: number
}

export type CurrentWeatherSummary = {
  city: string
  weatherLabel: string
  temperatureLabel: string
  advice: string
  fetchedAt: number
}

export type Member = {
  id: string
  familySpaceId: string
  role: string
  displayName: string
  elderAlias: string | null
  phone: string | null
  lastActivityAt: number | null
  alertPriority: number | null
  status: string
}

export type ConversationCard = {
  id: string
  conversationType: 'FAMILY_CHAT' | 'AI_ASSISTANT'
  memberId: string
  familyMemberId: string
  elderMemberId: string
  name: string
  familyDisplayName: string
  elderDisplayName: string
  avatar: string
  lastActivityAt: number | null
  unreadCount: number
  unreadSummary: string
  primaryMessage: {
    id: string
    type: 'text' | 'image' | 'voice' | 'video'
    preview: string
    mediaLabel: string | null
  } | null
}

export type Message = {
  id: string
  conversationId: string
  senderType: string
  senderMemberId: string | null
  messageType: string
  textContent: string | null
  mediaUrl: string | null
  voiceDurationSec: number | null
  transcript: string | null
  transcriptConfidence: number | null
  aiDrafted: boolean
  status: string
  isLowInformation: boolean
  createdAt: number
  deliveredAt: number | null
  consumedAt: number | null
  recalledAt: number | null
  emotion?: {
    severity: string
    label: string | null
    source: string | null
    summary: string
    excerpt: string | null
    createdAt: number
    mode?: string | null
  } | null
}

export type ConversationDetail = {
  id: string
  conversationType: 'FAMILY_CHAT' | 'AI_ASSISTANT'
  memberId: string
  familyMemberId: string
  elderMemberId: string
  name: string
  familyDisplayName: string
  elderDisplayName: string
  avatar: string
  messages: Message[]
}

export type MemoryEntry = {
  id: string
  familySpaceId: string
  sourceConvId: string | null
  sourceMsgId: string | null
  addedByMemberId: string
  addedAt: number
  memoryType: string
  title: string | null
  description: string | null
  mediaUrl: string | null
  status: string
  visibleScope: string
  createdAt: number
  updatedAt: number
}

export type Pulse = {
  id: string
  familySpaceId: string
  sourceType: string
  pulseType: string
  severity: string
  summary: string
  sourceConversationId: string | null
  sourceMessageId?: string | null
  sourceExcerpt?: string | null
  emotionSource?: string | null
  emotionLabel?: string | null
  status: string
  createdAt: number
  resolvedAt: number | null
}

export type EmotionSource = 'text' | 'face' | 'voice_tone' | 'text_fallback'

export type EmotionLabel =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'anxious'
  | 'sad'
  | 'angry'
  | 'calm'

export type EmotionSeverity = 'LOW' | 'MEDIUM' | 'HIGH'

export type EmotionResult = {
  source: EmotionSource
  label: EmotionLabel
  score: number
  severity: EmotionSeverity
  summary: string
  raw?: unknown
}

export type EmotionAnalyzeRequest = {
  conversationId: string
  familySpaceId?: string
  text?: string | null
  imageUrl?: string | null
  audioUrl?: string | null
  transcript?: string | null
}

export type EmotionAnalyzeResponse = {
  input: {
    conversationId: string
    familySpaceId: string
    text: string | null
    imageUrl: string | null
    audioUrl: string | null
    transcript: string | null
  }
  results: EmotionResult[]
  createdPulses: Pulse[]
  errors: Array<{
    code: string
    message: string
  }>
}

export type GenerationBridgeExplainRequest = {
  messageText?: string
  imageUrl?: string
  requesterRole: 'elder' | 'family'
}

export type GenerationBridgeGlossaryItem = {
  term: string
  meaning: string
}

export type GenerationBridgeExplainResponse = {
  explanation: string
  followUpSuggestion: string | null
  glossary: GenerationBridgeGlossaryItem[]
  mode: 'llm' | 'fallback'
}

export type FollowupRecord = {
  id: string
  linkedPulseId: string | null
  linkedAlertId: string | null
  handlerMemberId: string
  actionType: string
  resultTag: string | null
  resultNote: string | null
  status: string
  createdAt: number
}

export type Alert = {
  id: string
  familySpaceId: string
  alertType: string
  triggerSource: string
  status: string
  acknowledgedBy: string | null
  triggeredAt: number
  countdownDeadlineAt: number | null
  escalationLevel: number
  resolvedAt: number | null
  resolutionNote: string | null
}

export type PermissionPolicy = {
  id: string
  familySpaceId: string
  role: string
  canViewPulse: number
  canViewFollowup: number
  canViewMemory: number
  canReceiveSos: number
  canReceiveUnwell: number
  canManageMembers: number
  canManageAlertOrder: number
}

export type ICallSignal = {
  type: 'offer' | 'answer' | 'ice-candidate' | 'reject' | 'hangup'
  from: string
  to: string
  callId: string
  callType?: 'voice' | 'video'
  data?: Record<string, unknown>
  timestamp: number
}

export const MessageStatus = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
} as const

export type MessageStatus = typeof MessageStatus[keyof typeof MessageStatus]

export const MessageType = {
  TEXT: 'text',
  IMAGE: 'image',
  VOICE: 'voice',
  VIDEO: 'video',
} as const

export type MessageType = typeof MessageType[keyof typeof MessageType]

export interface IMessage {
  id: string
  conversationId: string
  senderId: string
  recipientId: string
  senderDisplayName?: string
  content: string
  type: MessageType | 'text' | 'image' | 'voice' | 'video'
  status: MessageStatus | 'sending' | 'sent' | 'delivered' | 'read'
  timestamp: number
  mediaUrl?: string
  voiceDurationMs?: number
  isDeleted?: boolean
}

export interface IConversation {
  id: string
  userId: string
  otherUserId: string
  otherUserName: string
  otherUserAvatar?: string
  lastMessage?: string
  lastMessageTime?: number
  unreadCount: number
  lastActivityAt: number
  isDeleted?: boolean
}

export interface INotificationOptions extends NotificationOptions {
  requireInteraction?: boolean
}
