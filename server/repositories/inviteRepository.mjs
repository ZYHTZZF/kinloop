import { getDatabase } from '../db/index.mjs'

export function listInviteCodes(familySpaceId) {
  const db = getDatabase()
  return db.prepare(`
    select
      invite_codes.id,
      invite_codes.family_space_id as familySpaceId,
      invite_codes.code,
      invite_codes.status,
      invite_codes.requested_role as requestedRole,
      invite_codes.target_member_id as targetMemberId,
      members.display_name as targetDisplayName,
      invite_codes.created_by_member_id as createdByMemberId,
      invite_codes.approved_member_id as approvedMemberId,
      invite_codes.expires_at as expiresAt,
      invite_codes.created_at as createdAt,
      invite_codes.approved_at as approvedAt
    from invite_codes
    left join members on members.id = invite_codes.target_member_id
    where invite_codes.family_space_id = ?
    order by created_at desc
  `).all(familySpaceId)
}

export function createInviteCode(payload, familySpaceId) {
  const db = getDatabase()
  const now = Date.now()
  const id = `invite_${now}`
  const code = `KIN${String(now).slice(-3)}`

  db.prepare(`
    insert into invite_codes (
      id, family_space_id, code, status, requested_role,
      created_by_member_id, approved_member_id, expires_at, created_at, approved_at
    ) values (
      $id, $familySpaceId, $code, $status, $requestedRole,
      $createdByMemberId, $approvedMemberId, $expiresAt, $createdAt, $approvedAt
    )
  `).run({
    id,
    familySpaceId,
    code,
    status: payload.status ?? 'ACTIVE',
    requestedRole: payload.requestedRole ?? 'Family',
    createdByMemberId: payload.createdByMemberId,
    approvedMemberId: null,
    expiresAt: now + 24 * 60 * 60 * 1000,
    createdAt: now,
    approvedAt: null,
  })

  return db.prepare(`
    select
      invite_codes.id,
      invite_codes.family_space_id as familySpaceId,
      invite_codes.code,
      invite_codes.status,
      invite_codes.requested_role as requestedRole,
      invite_codes.target_member_id as targetMemberId,
      members.display_name as targetDisplayName,
      invite_codes.created_by_member_id as createdByMemberId,
      invite_codes.approved_member_id as approvedMemberId,
      invite_codes.expires_at as expiresAt,
      invite_codes.created_at as createdAt,
      invite_codes.approved_at as approvedAt
    from invite_codes
    left join members on members.id = invite_codes.target_member_id
    where invite_codes.id = ?
  `).get(id)
}

export function approveInviteCode(inviteId, approvedMemberId, familySpaceId) {
  const db = getDatabase()
  const now = Date.now()

  db.prepare(`
    update invite_codes
    set status = 'APPROVED', approved_member_id = ?, approved_at = ?
    where id = ?
      and family_space_id = ?
  `).run(approvedMemberId, now, inviteId, familySpaceId)

  return db.prepare(`
    select
      invite_codes.id,
      invite_codes.family_space_id as familySpaceId,
      invite_codes.code,
      invite_codes.status,
      invite_codes.requested_role as requestedRole,
      invite_codes.target_member_id as targetMemberId,
      members.display_name as targetDisplayName,
      invite_codes.created_by_member_id as createdByMemberId,
      invite_codes.approved_member_id as approvedMemberId,
      invite_codes.expires_at as expiresAt,
      invite_codes.created_at as createdAt,
      invite_codes.approved_at as approvedAt
    from invite_codes
    left join members on members.id = invite_codes.target_member_id
    where invite_codes.id = ?
  `).get(inviteId)
}
