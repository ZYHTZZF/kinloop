import type { AuthMembership, AuthSession } from '../services/api/types'

export type OnboardingRole = 'elder' | 'family' | 'caregiver'

export type OnboardingAuthMode = 'login' | 'register' | 'forgot'

export type OnboardingFamilyMode = 'idle' | 'create' | 'join'

export type BoundFamilyMember = {
  id: string
  name: string
  role: OnboardingRole
  relation: string
  note: string
}

export type StoredAuthState = {
  token: string
  userId: string
  email: string
  role: OnboardingRole | null
  memberId: string
  familyId: string
  familyName: string
  familyCode: string
  memberDisplayName: string
  relationLabel: string
  completedAt: number | null
}

const STORAGE_KEY = 'kinloop-auth-session-v1'

const DEFAULT_STATE: StoredAuthState = {
  token: '',
  userId: '',
  email: '',
  role: null,
  memberId: '',
  familyId: '',
  familyName: '',
  familyCode: '',
  memberDisplayName: '',
  relationLabel: '',
  completedAt: null,
}

function mapMembership(membership: AuthMembership | null | undefined): StoredAuthState {
  return {
    token: '',
    userId: '',
    email: '',
    role: membership?.role ?? null,
    memberId: membership?.memberId ?? '',
    familyId: membership?.familySpaceId ?? '',
    familyName: membership?.familyName ?? '',
    familyCode: membership?.familyJoinCode ?? '',
    memberDisplayName: membership?.memberDisplayName ?? '',
    relationLabel: membership?.relationLabel ?? '',
    completedAt: membership ? Date.now() : null,
  }
}

export function getStoredAuthToken() {
  return getOnboardingState().token
}

export function getOnboardingState(): StoredAuthState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    return {
      ...DEFAULT_STATE,
      ...(JSON.parse(raw) as Partial<StoredAuthState>),
    }
  } catch {
    return DEFAULT_STATE
  }
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return
  }

  const membershipState = mapMembership(session.membership)
  const nextState: StoredAuthState = {
    ...membershipState,
    token: session.token,
    userId: session.user.id,
    email: session.user.email,
    completedAt: Date.now(),
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  window.dispatchEvent(new CustomEvent('kinloop:onboarding-updated'))
}

export function clearOnboardingState() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('kinloop:onboarding-updated'))
}

export function isOnboardingComplete() {
  const state = getOnboardingState()
  return Boolean(state.token && state.role && state.familyId && state.completedAt)
}

export function getPreferredHomePath() {
  const state = getOnboardingState()
  if (state.role === 'elder') return '/elder/home'
  if (state.role === 'caregiver') return '/family/collaboration'
  return '/family/today'
}
