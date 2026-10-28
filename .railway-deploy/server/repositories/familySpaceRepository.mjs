import { getDatabase } from '../db/index.mjs'

export function getFamilySpaceById(familySpaceId) {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      name,
      join_code as joinCode,
      elder_display_name as elderDisplayName,
      elder_birth_month as elderBirthMonth,
      elder_birth_day as elderBirthDay,
      elder_birth_calendar_type as elderBirthCalendarType,
      primary_member_id as primaryMemberId,
      created_by_user_id as createdByUserId,
      created_at as createdAt,
      updated_at as updatedAt
    from family_spaces
    where id = ?
    limit 1
  `).get(familySpaceId)
}

export function updateElderProfile(familySpaceId, payload) {
  const db = getDatabase()
  const now = Date.now()
  const elderDisplayName = String(payload.elderDisplayName ?? '').trim()
  const elderBirthMonth = normalizeBirthNumber(payload.elderBirthMonth, 1, 12)
  const elderBirthDay = normalizeBirthNumber(payload.elderBirthDay, 1, 31)
  const elderBirthCalendarType = normalizeCalendarType(payload.elderBirthCalendarType)

  if (!elderDisplayName) {
    throw new Error('长辈姓名不能为空')
  }

  db.prepare(`
    update family_spaces
    set
      elder_display_name = ?,
      elder_birth_month = ?,
      elder_birth_day = ?,
      elder_birth_calendar_type = ?,
      updated_at = ?
    where id = ?
  `).run(
    elderDisplayName,
    elderBirthMonth,
    elderBirthDay,
    elderBirthCalendarType,
    now,
    familySpaceId,
  )

  return getFamilySpaceById(familySpaceId)
}

function normalizeBirthNumber(value, min, max) {
  if (value === null || value === undefined || value === '') return null
  const nextValue = Number(value)
  if (!Number.isInteger(nextValue) || nextValue < min || nextValue > max) {
    throw new Error('生日日期不正确')
  }
  return nextValue
}

function normalizeCalendarType(value) {
  if (value === null || value === undefined || value === '') return null
  const nextValue = String(value)
  if (nextValue !== 'gregorian' && nextValue !== 'lunar') {
    throw new Error('生日类型不正确')
  }
  return nextValue
}
