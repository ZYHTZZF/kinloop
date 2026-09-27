/* eslint-disable @typescript-eslint/no-explicit-any */
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

// ============ Chat Feature Types ============

export const MessageStatus = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
} as const;

export type MessageStatus = typeof MessageStatus[keyof typeof MessageStatus];

export const MessageType = {
  TEXT: 'text',
  IMAGE: 'image',
  VOICE: 'voice',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export interface IMessage {
  id: string
  conversationId: string
  senderId: string
  recipientId: string
  senderDisplayName?: string
  content: string
  type: MessageType | 'text' | 'image' | 'voice'
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

export interface ICallSignal {
  type: 'offer' | 'answer' | 'ice-candidate' | 'reject' | 'hangup'
  from: string
  to: string
  callId: string
  callType?: 'voice' | 'video'
  data?: Record<string, any>
  timestamp: number
}

export interface ICallOffer extends ICallSignal {
  type: 'offer'
  data: {
    sdp: string // RTCSessionDescription
  }
}

export interface ICallAnswer extends ICallSignal {
  type: 'answer'
  data: {
    sdp: string
  }
}

export interface IIceCandidate extends ICallSignal {
  type: 'ice-candidate'
  data: {
    candidate: string
    sdpMLineIndex: number
    sdpMid: string
  }
}

export interface IIncomingCall {
  callId: string
  from: string
  fromName: string
  fromAvatar?: string
  callType: 'voice' | 'video'
  timestamp: number
}

export interface INotificationOptions {
  title?: string
  tag?: string
  icon?: string
  badge?: string
  body?: string
  data?: Record<string, any>
  requireInteraction?: boolean
  silent?: boolean
}

export interface IOnlineStatus {
  userId: string
  isOnline: boolean
  lastSeenAt?: number
}
