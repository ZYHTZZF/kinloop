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
    sourceMessageId: row.sourceMessageId,
    sourceExcerpt: row.sourceExcerpt,
    emotionSource: row.emotionSource,
    emotionLabel: row.emotionLabel,
    emotionMode: row.emotionMode,
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
      source_message_id as sourceMessageId,
      source_excerpt as sourceExcerpt,
      emotion_source as emotionSource,
      emotion_label as emotionLabel,
      emotion_mode as emotionMode,
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
      source_conversation_id, source_message_id, source_excerpt, emotion_source, emotion_label,
      emotion_mode,
      status, created_at, resolved_at
    ) values (
      $id, $familySpaceId, $sourceType, $pulseType, $severity, $summary,
      $sourceConversationId, $sourceMessageId, $sourceExcerpt, $emotionSource, $emotionLabel,
      $emotionMode,
      $status, $createdAt, $resolvedAt
    )
  `).run({
    id,
    familySpaceId: payload.familySpaceId,
    sourceType: payload.sourceType ?? 'AI',
    pulseType: payload.pulseType ?? 'Emotion',
    severity: payload.severity ?? 'LOW',
    summary: payload.summary ?? '',
    sourceConversationId: payload.sourceConversationId ?? null,
    sourceMessageId: payload.sourceMessageId ?? null,
    sourceExcerpt: payload.sourceExcerpt ?? null,
    emotionSource: payload.emotionSource ?? null,
    emotionLabel: payload.emotionLabel ?? null,
    emotionMode: payload.emotionMode ?? null,
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
      source_message_id as sourceMessageId,
      source_excerpt as sourceExcerpt,
      emotion_source as emotionSource,
      emotion_label as emotionLabel,
      emotion_mode as emotionMode,
      status,
      created_at as createdAt,
      resolved_at as resolvedAt
    from pulses
    where id = ?
  `).get(id)

  return mapPulse(pulse)
}
