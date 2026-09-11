import { apiGet, apiPatch, apiPost } from './client'
import type { Alert } from './types'

export function listActiveAlerts() {
  return apiGet<Alert[]>('/alerts/active')
}

export function createAlert(payload: Record<string, unknown>) {
  return apiPost<Alert>('/alerts', payload)
}

export function acknowledgeAlert(alertId: string, memberId: string) {
  return apiPatch<Alert>(`/alerts/${alertId}/acknowledge`, { memberId })
}

export function resolveAlert(alertId: string, resolutionNote: string) {
  return apiPatch<Alert>(`/alerts/${alertId}/resolve`, { resolutionNote })
}
