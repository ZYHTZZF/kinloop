export type FamilySpace = {
  id: string
  name: string
  elderDisplayName: string
  primaryMemberId: string
  createdAt: number
  updatedAt: number
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
  memberId: string
  name: string
  familyDisplayName: string
  elderDisplayName: string
  avatar: string
  lastActivityAt: number | null
  unreadCount: number
  unreadSummary: string
  primaryMessage: {
    id: string
    type: 'text' | 'image' | 'voice'
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
}

export type ConversationDetail = {
  id: string
  memberId: string
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
