import { getDatabase } from '../db/index.mjs'

export function listMembers() {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      role,
      display_name as displayName,
      elder_alias as elderAlias,
      phone,
      last_activity_at as lastActivityAt,
      alert_priority as alertPriority,
      status
    from members
    order by
      case role
        when 'Primary' then 1
        when 'Family' then 2
        when 'Trusted' then 3
        else 4
      end,
      display_name asc
  `).all()
}
