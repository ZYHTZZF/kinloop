import { apiGet } from './client'
import type { Pulse, TodayEmotionStatus } from './types'

export function listTodayPulses() {
  return apiGet<Pulse[]>('/pulses/today')
}

export function listPulseHistory() {
  return apiGet<Pulse[]>('/pulses/history')
}

export function getTodayEmotionStatus() {
  return apiGet<TodayEmotionStatus>('/pulses/today-summary')
}
