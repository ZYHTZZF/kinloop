import type { ConversationCard, ConversationDetail } from './types'
import { getOnboardingState } from '../../app/onboardingStorage'

type CacheEnvelope<T> = {
  updatedAt: number
  data: T
}

const FORCED_FAMILY_GROUP_NAME = '相亲相爱一家人'

function getCacheScope() {
  const state = getOnboardingState()
  return [
    state.userId || 'guest',
    state.familyId || 'family',
    state.role || 'role',
  ].join(':')
}

function getCardsKey(viewer: 'elder' | 'family') {
  return `kinloop:conversation-cards:${getCacheScope()}:${viewer}`
}

function getDetailKey(conversationId: string) {
  return `kinloop:conversation-detail:${getCacheScope()}:${conversationId}`
}

function filterCardsForViewer(viewer: 'elder' | 'family', cards: ConversationCard[]) {
  if (viewer !== 'family') {
    return cards
  }

  const memberId = getOnboardingState().memberId
  if (!memberId) {
    return cards
  }

  return cards.filter((card) => card.isGroup || card.familyMemberId === memberId || card.memberId === memberId)
}

function readEnvelope<T>(key: string): CacheEnvelope<T> | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as CacheEnvelope<T>
  } catch {
    return null
  }
}

function writeEnvelope<T>(key: string, data: T) {
  if (typeof window === 'undefined') return

  const value: CacheEnvelope<T> = {
    updatedAt: Date.now(),
    data,
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

function isFamilyGroupConversation(conversation: {
  conversationType?: string
  isGroup?: boolean
}) {
  return conversation.conversationType === 'FAMILY_GROUP' || conversation.isGroup === true
}

function getFallbackParticipantCount(conversation: {
  participantCount?: number
  participants?: Array<{ id: string }>
  elderMemberId?: string | null
  familyMemberId?: string | null
  messages?: Array<{ senderMemberId: string | null }>
}) {
  if (typeof conversation.participantCount === 'number' && conversation.participantCount > 0) {
    return conversation.participantCount
  }

  if ((conversation.participants?.length ?? 0) > 0) {
    return conversation.participants?.length ?? 0
  }

  const participantIds = new Set<string>()
  if (conversation.elderMemberId) {
    participantIds.add(conversation.elderMemberId)
  }
  if (conversation.familyMemberId) {
    participantIds.add(conversation.familyMemberId)
  }
  for (const message of conversation.messages ?? []) {
    if (message.senderMemberId) {
      participantIds.add(message.senderMemberId)
    }
  }

  return participantIds.size
}

export function normalizeConversationCard(card: ConversationCard): ConversationCard {
  if (!isFamilyGroupConversation(card)) {
    return card
  }

  return {
    ...card,
    isGroup: true,
    name: FORCED_FAMILY_GROUP_NAME,
    groupName: FORCED_FAMILY_GROUP_NAME,
    participantCount: getFallbackParticipantCount(card),
  }
}

export function normalizeConversationDetail(detail: ConversationDetail): ConversationDetail {
  if (!isFamilyGroupConversation(detail)) {
    return detail
  }

  return {
    ...detail,
    isGroup: true,
    name: FORCED_FAMILY_GROUP_NAME,
    groupName: FORCED_FAMILY_GROUP_NAME,
    participantCount: getFallbackParticipantCount(detail),
  }
}

export function getCachedConversationCards(viewer: 'elder' | 'family') {
  const cards = readEnvelope<ConversationCard[]>(getCardsKey(viewer))?.data ?? []
  return filterCardsForViewer(viewer, cards.map(normalizeConversationCard))
}

export function saveConversationCards(viewer: 'elder' | 'family', cards: ConversationCard[]) {
  writeEnvelope(getCardsKey(viewer), filterCardsForViewer(viewer, cards.map(normalizeConversationCard)))
}

export function getCachedConversationDetail(conversationId: string) {
  const detail = readEnvelope<ConversationDetail>(getDetailKey(conversationId))?.data ?? null
  return detail ? normalizeConversationDetail(detail) : null
}

export function saveConversationDetail(detail: ConversationDetail) {
  writeEnvelope(getDetailKey(detail.id), normalizeConversationDetail(detail))
}

export function patchCachedConversationCard(viewer: 'elder' | 'family', nextDetail: ConversationDetail) {
  const normalizedDetail = normalizeConversationDetail(nextDetail)
  const cards = getCachedConversationCards(viewer).map(normalizeConversationCard)
  const latestMessage = normalizedDetail.messages.at(-1) ?? null
  const currentMemberId = getOnboardingState().memberId || null
  const nextCards = cards.map((card) => {
    if (card.id !== normalizedDetail.id) return card
    return normalizeConversationCard({
      ...card,
      name: normalizedDetail.name,
      lastActivityAt: latestMessage?.createdAt ?? card.lastActivityAt,
      participants: normalizedDetail.participants,
      participantCount: normalizedDetail.participantCount,
      isGroup: normalizedDetail.isGroup,
      groupName: normalizedDetail.groupName,
      primaryMessage: latestMessage
        ? {
            id: latestMessage.id,
            type: normalizeMessageType(latestMessage.messageType),
            preview: buildCardPreview(latestMessage, normalizedDetail),
            mediaLabel: latestMessage.mediaUrl ?? null,
          }
        : card.primaryMessage,
      unreadCount: countUnreadMessages(viewer, normalizedDetail, currentMemberId),
    })
  })

  saveConversationCards(viewer, nextCards)
}

function normalizeMessageType(messageType: string): 'text' | 'image' | 'voice' | 'video' {
  const normalized = messageType.toLowerCase()
  if (normalized === 'image') return 'image'
  if (normalized === 'voice') return 'voice'
  if (normalized === 'video') return 'video'
  return 'text'
}

function buildCardPreview(message: ConversationDetail['messages'][number], detail: ConversationDetail) {
  const preview = message.textContent ?? message.transcript ?? ''
  if (detail.isGroup && message.senderDisplayName) {
    return `${message.senderDisplayName}: ${preview || '新消息'}`
  }

  return preview
}

function countUnreadMessages(viewer: 'elder' | 'family', detail: ConversationDetail, currentMemberId: string | null) {
  return detail.messages.filter((message) => {
    if (message.consumedAt || message.recalledAt || message.senderType === 'System') {
      return false
    }

    if (currentMemberId) {
      return message.senderMemberId !== currentMemberId
    }

    return viewer === 'family' ? message.senderType === 'Elder' : message.senderType === 'Family'
  }).length
}
