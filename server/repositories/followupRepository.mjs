import { getDatabase } from '../db/index.mjs'

export function listFollowups() {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      linked_pulse_id as linkedPulseId,
      linked_alert_id as linkedAlertId,
      handler_member_id as handlerMemberId,
      action_type as actionType,
      result_tag as resultTag,
      result_note as resultNote,
      status,
      created_at as createdAt
    from followup_records
    order by created_at desc
  `).all()
}

export function createFollowup(payload) {
  const db = getDatabase()
  const now = Date.now()
  const id = `followup_${now}`

  db.prepare(`
    insert into followup_records (
      id, linked_pulse_id, linked_alert_id, handler_member_id,
      action_type, result_tag, result_note, status, created_at
    ) values (
      $id, $linkedPulseId, $linkedAlertId, $handlerMemberId,
      $actionType, $resultTag, $resultNote, $status, $createdAt
    )
  `).run({
    id,
    linkedPulseId: payload.linkedPulseId ?? null,
    linkedAlertId: payload.linkedAlertId ?? null,
    handlerMemberId: payload.handlerMemberId,
    actionType: payload.actionType,
    resultTag: payload.resultTag ?? null,
    resultNote: payload.resultNote ?? null,
    status: payload.status ?? 'LINKED',
    createdAt: now,
  })

  if (payload.linkedPulseId) {
    db.prepare(`
      update pulses
      set status = 'RESOLVED', resolved_at = ?
      where id = ?
    `).run(now, payload.linkedPulseId)
  }

  if (payload.linkedAlertId) {
    db.prepare(`
      update alerts
      set status = 'RESOLVED', resolved_at = ?, resolution_note = ?
      where id = ?
    `).run(now, payload.resultNote ?? null, payload.linkedAlertId)
  }

  return db.prepare(`
    select
      id,
      linked_pulse_id as linkedPulseId,
      linked_alert_id as linkedAlertId,
      handler_member_id as handlerMemberId,
      action_type as actionType,
      result_tag as resultTag,
      result_note as resultNote,
      status,
      created_at as createdAt
    from followup_records
    where id = ?
  `).get(id)
}
