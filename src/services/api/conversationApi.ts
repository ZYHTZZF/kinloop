import { apiGet, apiPatch, apiPost } from './client'
import type { ConversationCard, ConversationDetail, MarkConversationReadRequest, MarkConversationReadResponse } from './types'
import {
  getCachedConversationCards,
  getCachedConversationDetail,
  patchCachedConversationCard,
  saveConversationCards,
  saveConversationDetail,
} from './conversationCache'
import { getOnboardingState } from '../../app/onboardingStorage'

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

export function listConversationCards(viewer: 'elder' | 'family' = 'elder') {
  const query = viewer === 'elder' ? '' : `?viewer=${viewer}`
  return apiGet<ConversationCard[]>(`/conversations/cards${query}`).then((cards) => {
    const visibleCards = filterCardsForViewer(viewer, cards)
    saveConversationCards(viewer, visibleCards)
    return visibleCards
  })
}

export function getConversationDetail(conversationId: string) {
  return apiGet<ConversationDetail>(`/conversations/${conversationId}`).then((detail) => {
    saveConversationDetail(detail)
    return detail
  })
}

export function sendMessage(conversationId: string, payload: Record<string, unknown>) {
  return apiPost<ConversationDetail>(`/conversations/${conversationId}/messages`, payload).then((detail) => {
    saveConversationDetail(detail)
    patchCachedConversationCard(payload.senderType === 'Family' ? 'family' : 'elder', detail)
    return detail
  })
}

export function markConversationRead(conversationId: string, payload: MarkConversationReadRequest) {
  return apiPatch<MarkConversationReadResponse>(`/conversations/${conversationId}/read-all`, payload).then((result) => {
    if (result.conversation) {
      saveConversationDetail(result.conversation)
      patchCachedConversationCard(payload.requesterRole, result.conversation)
    }
    return result
  })
}

export function readCachedConversationCards(viewer: 'elder' | 'family' = 'elder') {
  return getCachedConversationCards(viewer)
}

export function readCachedConversationDetail(conversationId: string) {
  return getCachedConversationDetail(conversationId)
}
