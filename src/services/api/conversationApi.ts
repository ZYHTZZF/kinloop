import { apiGet, apiPost } from './client'
import type { ConversationCard, ConversationDetail } from './types'

export function listConversationCards(viewer: 'elder' | 'family' = 'elder') {
  const query = viewer === 'elder' ? '' : `?viewer=${viewer}`
  return apiGet<ConversationCard[]>(`/conversations/cards${query}`)
}

export function getConversationDetail(conversationId: string) {
  return apiGet<ConversationDetail>(`/conversations/${conversationId}`)
}

export function sendMessage(conversationId: string, payload: Record<string, unknown>) {
  return apiPost<ConversationDetail>(`/conversations/${conversationId}/messages`, payload)
}
