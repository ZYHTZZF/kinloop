import { apiPost } from './client'
import type { UnreadSummaryRequest, UnreadSummaryResponse } from './types'

export function getUnreadSummary(payload: UnreadSummaryRequest) {
  return apiPost<UnreadSummaryResponse>('/ai/unread-summary', payload)
}
