import { getDatabase } from '../db/index.mjs'

export function listPermissionPolicies() {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      role,
      can_view_pulse as canViewPulse,
      can_view_followup as canViewFollowup,
      can_view_memory as canViewMemory,
      can_receive_sos as canReceiveSos,
      can_receive_unwell as canReceiveUnwell,
      can_manage_members as canManageMembers,
      can_manage_alert_order as canManageAlertOrder
    from permission_policies
    order by role asc
  `).all()
}
