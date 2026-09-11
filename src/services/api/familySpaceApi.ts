import { apiGet } from './client'
import type { FamilySpace } from './types'

export function getCurrentFamilySpace() {
  return apiGet<FamilySpace>('/family-space')
}
