import { getDatabase } from '../db/index.mjs'

export function listTodayPulses() {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      source_type as sourceType,
      pulse_type as pulseType,
      severity,
      summary,
      source_conversation_id as sourceConversationId,
      status,
      created_at as createdAt,
      resolved_at as resolvedAt
    from pulses
    order by created_at desc
  `).all()
}

export function listPulseHistory() {
  return listTodayPulses()
}
