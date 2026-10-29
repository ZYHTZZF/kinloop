import { apiGet, apiPost } from './client'
import type { AuthSession } from './types'

export function sendAuthCode(email: string, purpose: 'register' | 'reset_password') {
  return apiPost<{
    ok: boolean
    email: string
    purpose: string
    expiresAt: number
    delivery?: string
    devCode?: string
  }>('/auth/send-code', { email, purpose })
}

export function registerAccount(payload: {
  email: string
  code: string
  password: string
  role: 'elder' | 'family' | 'caregiver'
  familyAction: 'create' | 'join'
  familyName?: string
  familyCode?: string
  displayName: string
  relationLabel?: string
}) {
  return apiPost<AuthSession>('/auth/register', payload)
}

export function loginAccount(payload: { email: string; password: string }) {
  return apiPost<AuthSession>('/auth/login', payload)
}

export function loginWithElderInviteCode(inviteCode: string) {
  return apiPost<AuthSession>('/auth/elder-invite-login', { inviteCode })
}

export function resetPassword(payload: { email: string; code: string; newPassword: string }) {
  return apiPost<AuthSession>('/auth/reset-password', payload)
}

export function getCurrentSession() {
  return apiGet<AuthSession>('/auth/me')
}

export function logoutAccount() {
  return apiPost<void>('/auth/logout', {})
}
