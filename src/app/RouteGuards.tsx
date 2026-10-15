import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getPreferredHomePath, isOnboardingComplete } from './onboardingStorage'

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
