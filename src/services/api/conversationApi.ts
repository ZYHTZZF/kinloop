import { apiGet, apiPost } from './client'
import type { ConversationCard, ConversationDetail } from './types'

export function listConversationCards() {
  return apiGet<ConversationCard[]>('/conversations/cards')
}

export function getConversationDetail(conversationId: string) {
  return apiGet<ConversationDetail>(`/conversations/${conversationId}`)
}

export function sendMessage(conversationId: string, payload: Record<string, unknown>) {
  return apiPost<ConversationDetail>(`/conversations/${conversationId}/messages`, payload)
}
