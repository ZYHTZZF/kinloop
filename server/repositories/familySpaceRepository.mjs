import { getDatabase } from '../db/index.mjs'

export function getCurrentFamilySpace() {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      name,
      elder_display_name as elderDisplayName,
      primary_member_id as primaryMemberId,
      created_at as createdAt,
      updated_at as updatedAt
    from family_spaces
    limit 1
  `).get()
}
