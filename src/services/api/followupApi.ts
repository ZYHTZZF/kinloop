import { apiGet, apiPost } from './client'
import type { FollowupRecord } from './types'

export function listFollowups() {
  return apiGet<FollowupRecord[]>('/followups')
}

export function createFollowup(payload: Record<string, unknown>) {
  return apiPost<FollowupRecord>('/followups', payload)
}
