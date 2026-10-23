import type { ConversationCard, ConversationDetail } from './types'
import { getOnboardingState } from '../../app/onboardingStorage'

type CacheEnvelope<T> = {
  updatedAt: number
  data: T
}

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

  return cards.filter((card) => card.familyMemberId === memberId || card.memberId === memberId)
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

export function getCachedConversationCards(viewer: 'elder' | 'family') {
  return filterCardsForViewer(viewer, readEnvelope<ConversationCard[]>(getCardsKey(viewer))?.data ?? [])
}

export function saveConversationCards(viewer: 'elder' | 'family', cards: ConversationCard[]) {
  writeEnvelope(getCardsKey(viewer), filterCardsForViewer(viewer, cards))
}

export function getCachedConversationDetail(conversationId: string) {
  return readEnvelope<ConversationDetail>(getDetailKey(conversationId))?.data ?? null
}

export function saveConversationDetail(detail: ConversationDetail) {
  writeEnvelope(getDetailKey(detail.id), detail)
}

export function patchCachedConversationCard(viewer: 'elder' | 'family', nextDetail: ConversationDetail) {
  const cards = getCachedConversationCards(viewer)
  const latestMessage = nextDetail.messages.at(-1) ?? null
  const nextCards = cards.map((card) => {
    if (card.id !== nextDetail.id) return card
    return {
      ...card,
      lastActivityAt: latestMessage?.createdAt ?? card.lastActivityAt,
      primaryMessage: latestMessage
        ? {
            id: latestMessage.id,
            type: normalizeMessageType(latestMessage.messageType),
            preview: latestMessage.textContent ?? latestMessage.transcript ?? card.primaryMessage?.preview ?? '',
            mediaLabel: latestMessage.mediaUrl ?? null,
          }
        : card.primaryMessage,
      unreadCount: viewer === 'family'
        ? nextDetail.messages.filter((message) => message.senderType === 'Elder' && !message.consumedAt && !message.recalledAt).length
        : nextDetail.messages.filter((message) => message.senderType === 'Family' && !message.consumedAt && !message.recalledAt).length,
    }
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
