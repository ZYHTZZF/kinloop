import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getOnboardingState, getPreferredHomePath, isOnboardingComplete } from './onboardingStorage'

export function LandingRedirect() {
  return <Navigate to={isOnboardingComplete() ? getPreferredHomePath() : '/welcome'} replace />
}

export function RequireOnboarding() {
  const location = useLocation()

  if (isOnboardingComplete()) {
    return <Outlet />
  }

  const next = `${location.pathname}${location.search}${location.hash}`
  return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />
}

export function RequireRole({ allowed }: { allowed: Array<'elder' | 'family' | 'caregiver'> }) {
  const state = getOnboardingState()

  if (!state.role || !allowed.includes(state.role)) {
    return <Navigate to={getPreferredHomePath()} replace />
  }

  return <Outlet />
}
