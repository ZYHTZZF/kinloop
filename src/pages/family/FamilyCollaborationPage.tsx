import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import {
  acknowledgeAlert,
  createInviteCode,
  getCurrentFamilySpace,
  listActiveAlerts,
  listInviteCodes,
  listImportantEvents,
  listMembers,
  resolveAlert,
} from '../../services/api'
import type { Alert, FamilySpace, ImportantEvent, InviteCode, Member } from '../../services/api'
import { formatShortDateTime } from '../../utils/dateTime'

export function FamilyCollaborationPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [importantEvents, setImportantEvents] = useState<ImportantEvent[]>([])
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [familySpace, setFamilySpace] = useState<FamilySpace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [copiedJoinCode, setCopiedJoinCode] = useState(false)
  const [copiedElderInviteCode, setCopiedElderInviteCode] = useState(false)
  const [creatingElderInvite, setCreatingElderInvite] = useState(false)
  const [elderDisplayNameDraft, setElderDisplayNameDraft] = useState('')
  const [handlingAlertId, setHandlingAlertId] = useState<string | null>(null)
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [nextMembers, nextAlerts, nextFamilySpace, nextImportantEvents, nextInvites] = await Promise.all([
          listMembers(),
          listActiveAlerts(),
          getCurrentFamilySpace(),
          listImportantEvents(),
          listInviteCodes(),
        ])

        if (!cancelled) {
          const elderMember = nextMembers.find((member) => member.role === 'Elder')
          setMembers(nextMembers)
          setAlerts(nextAlerts)
          setFamilySpace(nextFamilySpace)
          setImportantEvents(nextImportantEvents)
          setInvites(nextInvites)
          setElderDisplayNameDraft(elderMember?.displayName ?? getInitialElderDisplayName(nextFamilySpace))
          setError('')
        }
      } catch {
        if (!cancelled) {
          setError('家庭协作信息暂时没有刷新出来，请稍后再试。')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const coreMembers = useMemo(
    () => members.filter((member) => member.role === 'Primary' || member.role === 'Family'),
    [members],
  )

  const suggestedRelay = useMemo(() => {
    return [...coreMembers]
      .filter((member) => member.status === 'Active')
      .sort((left, right) => (left.lastActivityAt ?? 0) - (right.lastActivityAt ?? 0))[0]
  }, [coreMembers])

  const recentContact = useMemo(() => {
    return [...coreMembers]
      .filter((member) => member.lastActivityAt)
      .sort((left, right) => (right.lastActivityAt ?? 0) - (left.lastActivityAt ?? 0))[0]
  }, [coreMembers])

  const alertOrder = useMemo(() => {
    return [...members]
      .filter((member) => member.alertPriority)
      .sort((left, right) => (left.alertPriority ?? 999) - (right.alertPriority ?? 999))
      .map((member) => `${member.alertPriority}. ${member.displayName}`)
      .join('  ')
  }, [members])

  const upcomingEvents = useMemo(() => {
    return getUpcomingImportantEvents(importantEvents, new Date(), 7).slice(0, 4)
  }, [importantEvents])

  const activeElderInvite = useMemo(() => {
    return invites.find((invite) => invite.requestedRole === 'Elder' && invite.status === 'ACTIVE')
  }, [invites])

  async function handleCopyJoinCode() {
    const joinCode = familySpace?.joinCode
    if (!joinCode) return

    try {
      await navigator.clipboard.writeText(joinCode)
      setCopiedJoinCode(true)
      setFeedback(`已复制家庭加入码：${joinCode}`)
      window.setTimeout(() => setCopiedJoinCode(false), 2000)
    } catch {
      setError('复制失败了，请再试一次。')
    }
  }

  async function handleCreateElderInvite() {
    const displayName = elderDisplayNameDraft.trim()
    if (!displayName) {
      setError('请先填写老人在家庭里的称呼。')
      return
    }

    try {
      setCreatingElderInvite(true)
      const invite = await createInviteCode({ requestedRole: 'Elder', displayName })
      const [nextMembers, nextFamilySpace, nextInvites] = await Promise.all([
        listMembers(),
        getCurrentFamilySpace(),
        listInviteCodes(),
      ])
      setMembers(nextMembers)
      setFamilySpace(nextFamilySpace)
      setInvites(nextInvites)
      setFeedback(`已生成${displayName}的专属邀请码：${invite.code}`)
      setError('')
    } catch {
      setError('老人专属邀请码暂时没有生成成功，请稍后再试。')
    } finally {
      setCreatingElderInvite(false)
    }
  }

  async function handleCopyElderInviteCode() {
    const inviteCode = activeElderInvite?.code
    if (!inviteCode) return

    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopiedElderInviteCode(true)
      setFeedback(`已复制老人专属邀请码：${inviteCode}`)
      window.setTimeout(() => setCopiedElderInviteCode(false), 2000)
    } catch {
      setError('复制失败了，请再试一次。')
    }
  }

  async function handleAcknowledgeAlert(alertId: string) {
    try {
      setHandlingAlertId(alertId)
      await acknowledgeAlert(alertId, members.find((member) => member.role === 'Primary')?.id ?? '')
      setAlerts(await listActiveAlerts())
      setFeedback('已接手这条提醒。')
      setError('')
    } catch {
      setError('暂时还没接手成功，请稍后再试。')
    } finally {
      setHandlingAlertId(null)
    }
  }

  async function handleResolveAlert(alertId: string) {
    try {
      setResolvingAlertId(alertId)
      await resolveAlert(alertId, '已联系家人并完成当前处理。')
      setAlerts(await listActiveAlerts())
      setFeedback('这条提醒已经处理完成。')
      setError('')
    } catch {
      setError('暂时还没关闭成功，请稍后再试。')
    } finally {
      setResolvingAlertId(null)
    }
  }

  return (
    <section className="screen screen--family-collaboration">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">协作</p>
            <h2>协作安排</h2>
          </div>
        </div>

        {feedback ? <p className="state-note collaboration-feedback">{feedback}</p> : null}

        <div className="collaboration-stack">
          {loading ? (
            <PageState title="正在整理家庭协作信息" description="稍等一下，我把成员、提醒和加入码整理出来。" />
          ) : null}

          {error ? <PageState variant="error" title="暂时无法查看家庭协作" description={error} /> : null}

          <Link className="members-card important-events-entry-card" to="/family/collaboration/events">
            <p className="surface-card__eyebrow">重要事件</p>
            <strong>生日、纪念日和家里的重要日子</strong>
            <p className="members-card__meta">添加后，会在匹配日期出现在首页今日提醒里。</p>
          </Link>

          <article className="task-card collaboration-today-card">
            <p className="surface-card__eyebrow">今日协作</p>
            <div className="collaboration-today-summary">
              <div>
                <span>建议接力</span>
                <strong>{suggestedRelay ? suggestedRelay.displayName : '暂无'}</strong>
              </div>
              <div>
                <span>最近联系</span>
                <strong>{recentContact ? `${recentContact.displayName} · ${formatShortDateTime(recentContact.lastActivityAt)}` : '暂无记录'}</strong>
              </div>
            </div>
            {alerts.length === 0 ? (
              <p className="state-note">现在没有待处理的提醒，今天的协作状态比较平稳。</p>
            ) : (
              <div className="list-stack">
                {alerts.map((alert) => (
                  <div className="list-row" key={alert.id}>
                    <div className="list-row__main">
                      <div>
                        <strong>{toAlertSummary(alert)}</strong>
                        <p>{toAlertStatus(alert)}</p>
                      </div>
                    </div>
                    <div className="inline-actions">
                      {alert.status !== 'HANDLING' ? (
                        <button
                          className="ghost-action"
                          type="button"
                          disabled={handlingAlertId === alert.id}
                          onClick={() => void handleAcknowledgeAlert(alert.id)}
                        >
                          {handlingAlertId === alert.id ? '处理中...' : '我来跟进'}
                        </button>
                      ) : null}
                      {alert.status === 'HANDLING' ? (
                        <button
                          className="ghost-action"
                          type="button"
                          disabled={resolvingAlertId === alert.id}
                          onClick={() => void handleResolveAlert(alert.id)}
                        >
                          {resolvingAlertId === alert.id ? '关闭中...' : '完成处理'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="members-card collaboration-members-card">
            <p className="surface-card__eyebrow">成员</p>
            <div className="list-stack">
              {members.map((member) => (
                <div className="list-row" key={member.id}>
                  <div className="list-row__main">
                    <div>
                      <strong>{member.displayName}</strong>
                      <p>{member.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="members-card__meta">紧急通知顺序：{alertOrder || '暂未设置'}</p>

            <div className="list-row">
              <div className="list-row__main">
                <label className="welcome-field">
                  <span>老人称呼</span>
                  <input
                    value={elderDisplayNameDraft}
                    onChange={(event) => setElderDisplayNameDraft(event.target.value)}
                    placeholder="例如 妈妈 / 爷爷"
                  />
                </label>
              </div>
              <div className="inline-actions">
                <button className="primary-action" type="button" onClick={() => void handleCreateElderInvite()} disabled={creatingElderInvite}>
                  {creatingElderInvite ? '生成中...' : activeElderInvite ? '重新生成老人邀请码' : '生成老人邀请码'}
                </button>
              </div>
            </div>

            <p className="members-card__meta">
              {activeElderInvite
                ? `${(activeElderInvite.targetDisplayName ?? elderDisplayNameDraft) || '长辈'}可用这个邀请码重复登录老人端。`
                : '生成后发给老人，老人只需要复制粘贴这个码登录。'}
            </p>
            <div className="inline-actions collaboration-members-actions">
              <span className="status-pill">老人专属邀请码：{activeElderInvite?.code ?? '暂未生成'}</span>
              <button className="primary-action" type="button" onClick={() => void handleCopyElderInviteCode()} disabled={!activeElderInvite?.code}>
                {copiedElderInviteCode ? '已复制' : '复制老人邀请码'}
              </button>
            </div>

            <div className="inline-actions collaboration-members-actions">
              <span className="status-pill">加入码：{familySpace?.joinCode ?? '暂未生成'}</span>
              <button className="primary-action" type="button" onClick={() => void handleCopyJoinCode()} disabled={!familySpace?.joinCode}>
                {copiedJoinCode ? '已复制' : '复制加入码'}
              </button>
            </div>
          </article>

          <article className="members-card collaboration-upcoming-card">
            <p className="surface-card__eyebrow">未来七天</p>
            {upcomingEvents.length > 0 ? (
              <div className="list-stack">
                {upcomingEvents.map((item) => (
                  <div className="list-row collaboration-upcoming-row" key={item.event.id}>
                    <div className="list-row__main">
                      <div>
                        <strong>{item.event.title}</strong>
                        <p>{formatUpcomingEventMeta(item)}</p>
                      </div>
                    </div>
                    <span className="status-pill">{getEventTypeLabel(item.event.eventType)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="state-note">未来七天暂无已添加的重要事件。</p>
            )}
            <Link className="ghost-action ghost-action--link" to="/family/collaboration/events">
              管理重要事件
            </Link>
          </article>
        </div>
      </section>
    </section>
  )
}

type UpcomingImportantEvent = {
  event: ImportantEvent
  date: Date
  daysUntil: number
}

function getInitialElderDisplayName(familySpace: FamilySpace) {
  const currentName = familySpace.elderDisplayName.trim()
  return currentName && currentName !== '待绑定长辈' ? currentName : ''
}

function getUpcomingImportantEvents(events: ImportantEvent[], fromDate: Date, daysAhead: number): UpcomingImportantEvent[] {
  const start = startOfDay(fromDate)
  return events
    .filter((event) => event.status !== 'deleted')
    .map((event) => {
      const date = getNextImportantEventDate(event, start, daysAhead)
      if (!date) return null
      return {
        event,
        date,
        daysUntil: Math.round((date.getTime() - start.getTime()) / 86400000),
      }
    })
    .filter((item): item is UpcomingImportantEvent => Boolean(item))
    .sort((left, right) => left.date.getTime() - right.date.getTime())
}

function getNextImportantEventDate(event: ImportantEvent, start: Date, daysAhead: number) {
  if (event.calendarType === 'lunar') {
    for (let offset = 0; offset <= daysAhead; offset += 1) {
      const candidate = addDays(start, offset)
      const lunarDate = getChineseLunarDateParts(candidate)
      if (lunarDate?.month === event.eventMonth && lunarDate.day === event.eventDay) {
        return candidate
      }
    }
    return null
  }

  const candidate = new Date(start.getFullYear(), event.eventMonth - 1, event.eventDay)
  const nextDate = candidate < start ? new Date(start.getFullYear() + 1, event.eventMonth - 1, event.eventDay) : candidate
  return nextDate.getTime() - start.getTime() <= daysAhead * 86400000 ? nextDate : null
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(date.getDate() + days)
  return nextDate
}

function getChineseLunarDateParts(date: Date): { month: number; day: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date)
    const month = Number(parts.find((part) => part.type === 'month')?.value)
    const day = Number(parts.find((part) => part.type === 'day')?.value)
    return Number.isFinite(month) && Number.isFinite(day) ? { month, day } : null
  } catch {
    return null
  }
}

function formatUpcomingEventMeta(item: UpcomingImportantEvent) {
  const calendarLabel = item.event.calendarType === 'lunar' ? '农历' : '公历'
  const dayLabel = item.daysUntil === 0 ? '今天' : item.daysUntil === 1 ? '明天' : `${item.daysUntil}天后`
  return `${dayLabel} · ${calendarLabel} ${item.event.eventMonth}月${item.event.eventDay}日`
}

function getEventTypeLabel(eventType: ImportantEvent['eventType']) {
  if (eventType === 'birthday') return '生日'
  if (eventType === 'anniversary') return '纪念日'
  return '重要日子'
}

function toAlertSummary(alert: Alert) {
  if (alert.alertType === 'SOS') {
    return '紧急求助'
  }

  return '需要尽快联系'
}

function toAlertStatus(alert: Alert) {
  if (alert.status === 'HANDLING') {
    return '已经有人在处理了'
  }

  if (alert.status === 'TRIGGERED') {
    return '刚刚收到，正在等家人查看'
  }

  return '已收到提醒'
}
