import { getDatabase } from '../db/index.mjs'

export function listActiveAlerts(familySpaceId) {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      alert_type as alertType,
      trigger_source as triggerSource,
      status,
      acknowledged_by as acknowledgedBy,
      triggered_at as triggeredAt,
      countdown_deadline_at as countdownDeadlineAt,
      escalation_level as escalationLevel,
      resolved_at as resolvedAt,
      resolution_note as resolutionNote
    from alerts
    where family_space_id = ?
      and status != 'RESOLVED'
    order by triggered_at desc
  `).all(familySpaceId)
}

export function createAlert(payload, familySpaceId) {
  const db = getDatabase()
  const now = Date.now()
  const id = `alert_${now}`

  db.prepare(`
    insert into alerts (
      id, family_space_id, alert_type, trigger_source, status,
      acknowledged_by, triggered_at, countdown_deadline_at, escalation_level,
      resolved_at, resolution_note
    ) values (
      $id, $familySpaceId, $alertType, $triggerSource, $status,
      $acknowledgedBy, $triggeredAt, $countdownDeadlineAt, $escalationLevel,
      $resolvedAt, $resolutionNote
    )
  `).run({
    id,
    familySpaceId,
    alertType: payload.alertType,
    triggerSource: payload.triggerSource,
    status: payload.status ?? 'TRIGGERED',
    acknowledgedBy: payload.acknowledgedBy ?? null,
    triggeredAt: now,
    countdownDeadlineAt: payload.countdownDeadlineAt ?? null,
    escalationLevel: payload.escalationLevel ?? 1,
    resolvedAt: null,
    resolutionNote: null,
  })

  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      alert_type as alertType,
      trigger_source as triggerSource,
      status,
      acknowledged_by as acknowledgedBy,
      triggered_at as triggeredAt,
      countdown_deadline_at as countdownDeadlineAt,
      escalation_level as escalationLevel,
      resolved_at as resolvedAt,
      resolution_note as resolutionNote
    from alerts
    where id = ?
  `).get(id)
}

export function acknowledgeAlert(alertId, memberId, familySpaceId) {
  const db = getDatabase()
  db.prepare(`
    update alerts
    set status = 'HANDLING', acknowledged_by = ?
    where id = ?
      and family_space_id = ?
  `).run(memberId, alertId, familySpaceId)

  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      alert_type as alertType,
      trigger_source as triggerSource,
      status,
      acknowledged_by as acknowledgedBy,
      triggered_at as triggeredAt,
      countdown_deadline_at as countdownDeadlineAt,
      escalation_level as escalationLevel,
      resolved_at as resolvedAt,
      resolution_note as resolutionNote
    from alerts
    where id = ?
  `).get(alertId)
}

export function resolveAlert(alertId, payload, familySpaceId) {
  const db = getDatabase()
  const now = Date.now()

  db.prepare(`
    update alerts
    set status = 'RESOLVED', resolved_at = ?, resolution_note = ?
    where id = ?
      and family_space_id = ?
  `).run(now, payload.resolutionNote ?? null, alertId, familySpaceId)

  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      alert_type as alertType,
      trigger_source as triggerSource,
      status,
      acknowledged_by as acknowledgedBy,
      triggered_at as triggeredAt,
      countdown_deadline_at as countdownDeadlineAt,
      escalation_level as escalationLevel,
      resolved_at as resolvedAt,
      resolution_note as resolutionNote
    from alerts
    where id = ?
  `).get(alertId)
}
