import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import {
  acknowledgeAlert,
  getCurrentFamilySpace,
  listActiveAlerts,
  listMembers,
  resolveAlert,
} from '../../services/api'
import type { Alert, FamilySpace, Member } from '../../services/api'
import { formatShortDateTime } from '../../utils/dateTime'

export function FamilyCollaborationPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [familySpace, setFamilySpace] = useState<FamilySpace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [copiedJoinCode, setCopiedJoinCode] = useState(false)
  const [handlingAlertId, setHandlingAlertId] = useState<string | null>(null)
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [nextMembers, nextAlerts, nextFamilySpace] = await Promise.all([
          listMembers(),
          listActiveAlerts(),
          getCurrentFamilySpace(),
        ])

        if (!cancelled) {
          setMembers(nextMembers)
          setAlerts(nextAlerts)
          setFamilySpace(nextFamilySpace)
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
            <h2>把今天谁来接力、谁来处理，安排得更清楚。</h2>
          </div>
        </div>

        <div className="collaboration-stack">
          {loading ? (
            <PageState title="正在整理家庭协作信息" description="稍等一下，我把成员、提醒和加入码整理出来。" />
          ) : null}

          {error ? <PageState variant="error" title="暂时无法查看家庭协作" description={error} /> : null}

          {feedback ? <p className="state-note">{feedback}</p> : null}

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

          <article className="members-card">
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
            <div className="inline-actions collaboration-members-actions">
              <span className="status-pill">加入码：{familySpace?.joinCode ?? '暂未生成'}</span>
              <button className="primary-action" type="button" onClick={() => void handleCopyJoinCode()} disabled={!familySpace?.joinCode}>
                {copiedJoinCode ? '已复制' : '复制加入码'}
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>
  )
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
