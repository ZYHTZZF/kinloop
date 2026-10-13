import { apiGet, apiPatch, apiPost } from './client'
import type { ConversationCard, ConversationDetail, MarkConversationReadRequest, MarkConversationReadResponse } from './types'

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

export function markConversationRead(conversationId: string, payload: MarkConversationReadRequest) {
  return apiPatch<MarkConversationReadResponse>(`/conversations/${conversationId}/read-all`, payload)
}
