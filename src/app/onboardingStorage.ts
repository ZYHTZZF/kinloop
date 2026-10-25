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

type AuthScope = 'elder' | 'family' | 'global'

const STORAGE_KEY = 'kinloop-auth-session-v1'
const STORAGE_KEY_ELDER = `${STORAGE_KEY}:elder`
const STORAGE_KEY_FAMILY = `${STORAGE_KEY}:family`
const STORAGE_KEY_ACTIVE_SCOPE = `${STORAGE_KEY}:active-scope`

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

function getStorageKey(scope: AuthScope) {
  if (scope === 'elder') return STORAGE_KEY_ELDER
  if (scope === 'family') return STORAGE_KEY_FAMILY
  return STORAGE_KEY
}

function readStoredState(key: string): StoredAuthState | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return {
      ...DEFAULT_STATE,
      ...(JSON.parse(raw) as Partial<StoredAuthState>),
    }
  } catch {
    return null
  }
}

function writeStoredState(key: string, state: StoredAuthState) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(state))
}

function getScopeFromRole(role: OnboardingRole | null | undefined): AuthScope {
  return role === 'elder' ? 'elder' : role === 'family' || role === 'caregiver' ? 'family' : 'global'
}

function isStateCompatibleWithScope(state: StoredAuthState | null, scope: AuthScope) {
  if (!state?.role) {
    return false
  }

  if (scope === 'elder') {
    return state.role === 'elder'
  }

  if (scope === 'family') {
    return state.role === 'family' || state.role === 'caregiver'
  }

  return true
}

function getRouteScope(): AuthScope {
  if (typeof window === 'undefined') {
    return 'global'
  }

  const pathname = window.location.pathname || '/'
  if (pathname.startsWith('/elder')) {
    return 'elder'
  }

  if (pathname.startsWith('/family')) {
    return 'family'
  }

  return 'global'
}

function getActiveScope() {
  if (typeof window === 'undefined') {
    return 'global'
  }

  const storedScope = window.localStorage.getItem(STORAGE_KEY_ACTIVE_SCOPE)
  return storedScope === 'elder' || storedScope === 'family' ? storedScope : 'global'
}

function setActiveScope(scope: AuthScope) {
  if (typeof window === 'undefined') {
    return
  }

  if (scope === 'elder' || scope === 'family') {
    window.localStorage.setItem(STORAGE_KEY_ACTIVE_SCOPE, scope)
    return
  }

  window.localStorage.removeItem(STORAGE_KEY_ACTIVE_SCOPE)
}

function getFallbackStateForScope(scope: AuthScope) {
  const scopedState = readStoredState(getStorageKey(scope))
  if (isStateCompatibleWithScope(scopedState, scope)) {
    return scopedState
  }

  const globalState = readStoredState(STORAGE_KEY)
  if (scope !== 'global' && globalState && isStateCompatibleWithScope(globalState, scope)) {
    writeStoredState(getStorageKey(scope), globalState)
    return globalState
  }

  return scope === 'global' ? globalState : null
}

function resolveScopedState() {
  const routeScope = getRouteScope()
  if (routeScope !== 'global') {
    return getFallbackStateForScope(routeScope) ?? DEFAULT_STATE
  }

  const activeScope = getActiveScope()
  return getFallbackStateForScope(activeScope) ?? readStoredState(STORAGE_KEY) ?? DEFAULT_STATE
}

export function getStoredAuthToken() {
  return getOnboardingState().token
}

export function getOnboardingState(): StoredAuthState {
  return resolveScopedState()
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

  const scope = getScopeFromRole(nextState.role)
  writeStoredState(STORAGE_KEY, nextState)
  writeStoredState(getStorageKey(scope), nextState)
  setActiveScope(scope)
  window.dispatchEvent(new CustomEvent('kinloop:onboarding-updated'))
}

export function clearOnboardingState() {
  if (typeof window === 'undefined') {
    return
  }

  const routeScope = getRouteScope()
  const targetKey = getStorageKey(routeScope)
  const currentState = readStoredState(targetKey)

  if (routeScope !== 'global') {
    window.localStorage.removeItem(targetKey)
  } else {
    window.localStorage.removeItem(STORAGE_KEY)
  }

  const globalState = readStoredState(STORAGE_KEY)
  if (
    globalState
    && currentState
    && globalState.token
    && globalState.token === currentState.token
  ) {
    const siblingScope = routeScope === 'elder' ? 'family' : routeScope === 'family' ? 'elder' : 'global'
    const siblingState = siblingScope === 'global' ? null : readStoredState(getStorageKey(siblingScope))
    if (siblingState?.token) {
      writeStoredState(STORAGE_KEY, siblingState)
      setActiveScope(siblingScope)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
      setActiveScope('global')
    }
  } else if (routeScope === 'global') {
    const elderState = readStoredState(STORAGE_KEY_ELDER)
    const familyState = readStoredState(STORAGE_KEY_FAMILY)
    if (elderState?.token) {
      writeStoredState(STORAGE_KEY, elderState)
      setActiveScope('elder')
    } else if (familyState?.token) {
      writeStoredState(STORAGE_KEY, familyState)
      setActiveScope('family')
    } else {
      setActiveScope('global')
    }
  }

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
