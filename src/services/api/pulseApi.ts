import { apiGet } from './client'
import type { Pulse } from './types'

export function listTodayPulses() {
  return apiGet<Pulse[]>('/pulses/today')
}

export function listPulseHistory() {
  return apiGet<Pulse[]>('/pulses/history')
}
