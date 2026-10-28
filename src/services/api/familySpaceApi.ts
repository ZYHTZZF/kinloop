import { apiGet, apiPatch } from './client'
import type { FamilySpace } from './types'

export function getCurrentFamilySpace() {
  return apiGet<FamilySpace>('/family-space')
}

export function updateElderProfile(payload: {
  elderDisplayName: string
  elderBirthMonth: number | null
  elderBirthDay: number | null
  elderBirthCalendarType: 'gregorian' | 'lunar' | null
}) {
  return apiPatch<FamilySpace>('/family-space/elder-profile', payload)
}
