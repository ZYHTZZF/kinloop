import { randomUUID } from 'node:crypto'
import { getDatabase } from '../db/index.mjs'

export function listImportantEvents(familySpaceId) {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      title,
      event_type as eventType,
      calendar_type as calendarType,
      event_month as eventMonth,
      event_day as eventDay,
      note,
      status,
      created_at as createdAt,
      updated_at as updatedAt
    from important_events
    where family_space_id = ? and status = 'ACTIVE'
    order by event_month asc, event_day asc, created_at desc
  `).all(familySpaceId)
}

export function createImportantEvent(familySpaceId, payload) {
  const db = getDatabase()
  const now = Date.now()
  const event = {
    id: randomUUID(),
    familySpaceId,
    title: normalizeTitle(payload.title),
    eventType: normalizeEventType(payload.eventType),
    calendarType: normalizeCalendarType(payload.calendarType),
    eventMonth: normalizeNumber(payload.eventMonth, 1, 12, '事件月份不正确'),
    eventDay: normalizeNumber(payload.eventDay, 1, 31, '事件日期不正确'),
    note: normalizeOptionalText(payload.note),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  }

  db.prepare(`
    insert into important_events (
      id,
      family_space_id,
      title,
      event_type,
      calendar_type,
      event_month,
      event_day,
      note,
      status,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.familySpaceId,
    event.title,
    event.eventType,
    event.calendarType,
    event.eventMonth,
    event.eventDay,
    event.note,
    event.status,
    event.createdAt,
    event.updatedAt,
  )

  return event
}

function normalizeTitle(value) {
  const title = String(value ?? '').trim()
  if (!title) throw new Error('事件名称不能为空')
  return title.slice(0, 40)
}

function normalizeEventType(value) {
  const eventType = String(value ?? 'custom')
  return ['birthday', 'anniversary', 'custom'].includes(eventType) ? eventType : 'custom'
}

function normalizeCalendarType(value) {
  const calendarType = String(value ?? 'gregorian')
  if (calendarType !== 'gregorian' && calendarType !== 'lunar') {
    throw new Error('日期类型不正确')
  }
  return calendarType
}

function normalizeNumber(value, min, max, message) {
  const nextValue = Number(value)
  if (!Number.isInteger(nextValue) || nextValue < min || nextValue > max) {
    throw new Error(message)
  }
  return nextValue
}

function normalizeOptionalText(value) {
  const text = String(value ?? '').trim()
  return text ? text.slice(0, 120) : null
}
