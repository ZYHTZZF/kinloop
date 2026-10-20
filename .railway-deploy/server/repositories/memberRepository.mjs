import { getDatabase } from '../db/index.mjs'

export function listMembers(familySpaceId) {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      user_id as userId,
      role,
      display_name as displayName,
      relation_label as relationLabel,
      elder_alias as elderAlias,
      phone,
      last_activity_at as lastActivityAt,
      alert_priority as alertPriority,
      status
    from members
    where family_space_id = ?
    order by
      case role
        when 'Primary' then 1
        when 'Family' then 2
        when 'Trusted' then 3
        else 4
      end,
      display_name asc
  `).all(familySpaceId)
}
