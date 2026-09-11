import { apiGet } from './client'
import type { Member } from './types'

export function listMembers() {
  return apiGet<Member[]>('/members')
}
