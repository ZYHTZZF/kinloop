import { getDatabase } from '../db/index.mjs'

export function getFamilySpaceById(familySpaceId) {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      name,
      join_code as joinCode,
      elder_display_name as elderDisplayName,
      primary_member_id as primaryMemberId,
      created_by_user_id as createdByUserId,
      created_at as createdAt,
      updated_at as updatedAt
    from family_spaces
    where id = ?
    limit 1
  `).get(familySpaceId)
}
