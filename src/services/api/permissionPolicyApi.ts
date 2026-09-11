import { apiGet } from './client'
import type { PermissionPolicy } from './types'

export function listPermissionPolicies() {
  return apiGet<PermissionPolicy[]>('/permission-policies')
}
