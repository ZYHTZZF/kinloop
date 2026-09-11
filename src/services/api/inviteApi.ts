import { apiGet, apiPatch, apiPost } from './client'

export type InviteCode = {
  id: string
  familySpaceId: string
  code: string
  status: string
  requestedRole: string
  createdByMemberId: string
  approvedMemberId: string | null
  expiresAt: number
  createdAt: number
  approvedAt: number | null
}

export function listInviteCodes() {
  return apiGet<InviteCode[]>('/invites')
}

export function createInviteCode(payload: Record<string, unknown>) {
  return apiPost<InviteCode>('/invites', payload)
}

export function approveInviteCode(inviteId: string, approvedMemberId: string) {
  return apiPatch<InviteCode>(`/invites/${inviteId}/approve`, { approvedMemberId })
}
