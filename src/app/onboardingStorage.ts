export type OnboardingRole = 'elder' | 'family' | 'caregiver'

export type OnboardingAuthMode = 'login' | 'register'

export type OnboardingFamilyMode = 'idle' | 'create' | 'join' | 'skip'

export type BoundFamilyMember = {
  id: string
  name: string
  role: OnboardingRole
  relation: string
  note: string
}

export type OnboardingState = {
  isAuthenticated: boolean
  authMode: OnboardingAuthMode
  account: string
  role: OnboardingRole | null
  familyMode: OnboardingFamilyMode
  familyId: string
  familyName: string
  members: BoundFamilyMember[]
  completedAt: number | null
}

const STORAGE_KEY = 'kinloop-onboarding-state-v1'

const DEFAULT_STATE: OnboardingState = {
  isAuthenticated: false,
  authMode: 'login',
  account: '',
  role: null,
  familyMode: 'idle',
  familyId: '',
  familyName: '未绑定家庭',
  members: [],
  completedAt: null,
}

export function getOnboardingState(): OnboardingState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return DEFAULT_STATE
    }

    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      ...DEFAULT_STATE,
      ...parsed,
      members: Array.isArray(parsed.members) ? parsed.members : [],
    }
  } catch {
    return DEFAULT_STATE
  }
}

export function saveOnboardingState(state: OnboardingState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
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
  return state.isAuthenticated && Boolean(state.role) && state.familyMode !== 'idle' && Boolean(state.completedAt)
}

export function getPreferredHomePath() {
  const state = getOnboardingState()

  if (state.role === 'elder') return '/elder/home'
  if (state.role === 'caregiver') return '/family/collaboration'
  return '/family/today'
}
