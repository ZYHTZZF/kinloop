import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createImportantEvent, listImportantEvents } from '../../services/api'
import type { ImportantEvent } from '../../services/api'
import { PageState } from '../../components/common/PageState'
import { IMPORTANT_EVENTS_UPDATED_EVENT } from '../../app/layouts/FamilyAppLayout'

type EventDraft = {
  title: string
  eventType: ImportantEvent['eventType']
  calendarType: ImportantEvent['calendarType']
  eventMonth: string
  eventDay: string
  note: string
}

const initialDraft: EventDraft = {
  title: '',
  eventType: 'birthday',
  calendarType: 'gregorian',
  eventMonth: '',
  eventDay: '',
  note: '',
}

export function FamilyImportantEventsPage() {
  const [events, setEvents] = useState<ImportantEvent[]>([])
  const [draft, setDraft] = useState<EventDraft>(initialDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadEvents() {
      try {
        const nextEvents = await listImportantEvents()
        if (!cancelled) {
          setEvents(nextEvents)
          setError('')
        }
      } catch {
        if (!cancelled) {
          setError('重要事件暂时没有刷新出来，请稍后再试。')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadEvents()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreateEvent() {
    const title = draft.title.trim()
    const eventMonth = Number(draft.eventMonth)
    const eventDay = Number(draft.eventDay)

    if (!title) {
      setError('请先填写事件名称。')
      return
    }

    if (!Number.isInteger(eventMonth) || eventMonth < 1 || eventMonth > 12 || !Number.isInteger(eventDay) || eventDay < 1 || eventDay > 31) {
      setError('请填写正确的月份和日期。')
      return
    }

    try {
      setSaving(true)
      const nextEvent = await createImportantEvent({
        title,
        eventType: draft.eventType,
        calendarType: draft.calendarType,
        eventMonth,
        eventDay,
        note: draft.note.trim() || null,
      })
      setEvents((current) => [nextEvent, ...current])
      window.dispatchEvent(new Event(IMPORTANT_EVENTS_UPDATED_EVENT))
      setDraft(initialDraft)
      setFeedback('重要事件已添加，匹配日期时会显示在首页提醒里。')
      setError('')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '重要事件暂时没有添加成功，请稍后再试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="screen screen--family-important-events">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">重要事件</p>
            <h2>把生日、纪念日和家里的重要日子放在这里。</h2>
          </div>
          <Link className="ghost-action ghost-action--link" to="/family/collaboration">
            返回协作
          </Link>
        </div>

        {loading ? <PageState title="正在整理重要事件" description="稍等一下，正在读取已经添加的重要日子。" /> : null}
        {error ? <PageState variant="error" title="暂时无法处理重要事件" description={error} /> : null}
        {feedback ? <p className="state-note">{feedback}</p> : null}

        <article className="members-card important-event-form">
          <p className="surface-card__eyebrow">新增事件</p>
          <div className="elder-profile-grid">
            <label className="elder-profile-field">
              <span>事件名称</span>
              <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="例如：妈妈生日" />
            </label>
            <label className="elder-profile-field">
              <span>事件类型</span>
              <select value={draft.eventType} onChange={(event) => setDraft((current) => ({ ...current, eventType: event.target.value as ImportantEvent['eventType'] }))}>
                <option value="birthday">生日</option>
                <option value="anniversary">纪念日</option>
                <option value="custom">其他</option>
              </select>
            </label>
            <label className="elder-profile-field">
              <span>日期类型</span>
              <select value={draft.calendarType} onChange={(event) => setDraft((current) => ({ ...current, calendarType: event.target.value as ImportantEvent['calendarType'] }))}>
                <option value="gregorian">公历</option>
                <option value="lunar">农历</option>
              </select>
            </label>
            <label className="elder-profile-field">
              <span>月份</span>
              <input type="number" min="1" max="12" value={draft.eventMonth} onChange={(event) => setDraft((current) => ({ ...current, eventMonth: event.target.value }))} />
            </label>
            <label className="elder-profile-field">
              <span>日期</span>
              <input type="number" min="1" max="31" value={draft.eventDay} onChange={(event) => setDraft((current) => ({ ...current, eventDay: event.target.value }))} />
            </label>
            <label className="elder-profile-field important-event-note-field">
              <span>备注</span>
              <input value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="可选，例如提前准备祝福" />
            </label>
          </div>
          <div className="inline-actions">
            <button className="primary-action" type="button" disabled={saving} onClick={() => void handleCreateEvent()}>
              {saving ? '添加中...' : '添加重要事件'}
            </button>
          </div>
        </article>

        {!loading && events.length === 0 ? (
          <PageState title="还没有重要事件" description="添加生日或纪念日后，匹配当天会出现在首页提醒。" />
        ) : null}

        {events.length > 0 ? (
          <div className="important-event-list">
            {events.map((event) => (
              <article className="important-event-card" key={event.id}>
                <div>
                  <span className="status-pill">{getEventTypeLabel(event.eventType)}</span>
                  <h3>{event.title}</h3>
                  <p>{event.calendarType === 'lunar' ? '农历' : '公历'} {event.eventMonth}月{event.eventDay}日</p>
                  {event.note ? <small>{event.note}</small> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  )
}

function getEventTypeLabel(eventType: ImportantEvent['eventType']) {
  if (eventType === 'birthday') return '生日'
  if (eventType === 'anniversary') return '纪念日'
  return '重要日子'
}
