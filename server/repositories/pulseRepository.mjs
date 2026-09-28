import { getDatabase } from '../db/index.mjs'

function mapPulse(row) {
  return {
    id: row.id,
    familySpaceId: row.familySpaceId,
    sourceType: row.sourceType,
    pulseType: row.pulseType,
    severity: row.severity,
    summary: row.summary,
    sourceConversationId: row.sourceConversationId,
    status: row.status,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }
}

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
  `).all().map(mapPulse)
}

export function listPulseHistory() {
  return listTodayPulses()
}

export function createPulse(payload) {
  const db = getDatabase()
  const now = Date.now()
  const id = payload.id ?? `pulse_${now}_${Math.floor(Math.random() * 10000)}`

  db.prepare(`
    insert into pulses (
      id, family_space_id, source_type, pulse_type, severity, summary,
      source_conversation_id, status, created_at, resolved_at
    ) values (
      $id, $familySpaceId, $sourceType, $pulseType, $severity, $summary,
      $sourceConversationId, $status, $createdAt, $resolvedAt
    )
  `).run({
    id,
    familySpaceId: payload.familySpaceId,
    sourceType: payload.sourceType ?? 'AI',
    pulseType: payload.pulseType ?? 'Emotion',
    severity: payload.severity ?? 'LOW',
    summary: payload.summary ?? '',
    sourceConversationId: payload.sourceConversationId ?? null,
    status: payload.status ?? 'OPEN',
    createdAt: payload.createdAt ?? now,
    resolvedAt: payload.resolvedAt ?? null,
  })

  const pulse = db.prepare(`
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
    where id = ?
  `).get(id)

  return mapPulse(pulse)
}
