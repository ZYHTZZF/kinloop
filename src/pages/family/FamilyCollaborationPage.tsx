import { useEffect, useMemo, useState } from 'react'
import { PageState } from '../../components/common/PageState'
import {
  acknowledgeAlert,
  approveInviteCode,
  createInviteCode,
  listActiveAlerts,
  listInviteCodes,
  listMembers,
  resolveAlert,
} from '../../services/api'
import type { Alert, InviteCode, Member } from '../../services/api'
import { formatShortDateTime } from '../../utils/dateTime'

export function FamilyCollaborationPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteFeedback, setInviteFeedback] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [approvingInviteId, setApprovingInviteId] = useState<string | null>(null)
  const [handlingAlertId, setHandlingAlertId] = useState<string | null>(null)
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [nextMembers, nextAlerts, nextInvites] = await Promise.all([
          listMembers(),
          listActiveAlerts(),
          listInviteCodes(),
        ])

        if (!cancelled) {
          setMembers(nextMembers)
          setAlerts(nextAlerts)
          setInvites(nextInvites)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载协作数据失败')
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
      .sort((left, right) => {
        const leftTime = left.lastActivityAt ?? 0
        const rightTime = right.lastActivityAt ?? 0
        return leftTime - rightTime
      })[0]
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

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === 'PENDING'),
    [invites],
  )

  const activeInvite = useMemo(
    () => invites.find((invite) => invite.status === 'ACTIVE'),
    [invites],
  )
  const activeAlertCount = alerts.length

  return (
    <section className="screen screen--family-collaboration">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">协作</p>
            <h2>把家人的关心接成一条线，让今天该谁接力更清楚。</h2>
          </div>
        </div>

        <div className="collaboration-overview-strip">
          <div className="today-overview-chip">
            <span>核心成员</span>
            <strong>{coreMembers.length}</strong>
          </div>
          <div className="today-overview-chip">
            <span>待处理任务</span>
            <strong>{activeAlertCount}</strong>
          </div>
          <div className="today-overview-chip">
            <span>待审批加入</span>
            <strong>{pendingInvites.length}</strong>
          </div>
        </div>

        {!loading && !error ? (
          <article className="note-card collaboration-relay-note">
            <p className="surface-card__eyebrow">推荐接力</p>
            <strong>{suggestedRelay ? `今天更适合由 ${suggestedRelay.displayName} 接一句。` : '当前还没有合适的接力建议。'}</strong>
            <p>
              {suggestedRelay
                ? `${suggestedRelay.displayName} 最近比较久没有联系长辈，现在接上会更自然。`
                : '成员活动数据还不够，先保持当前分工即可。'}
            </p>
          </article>
        ) : null}

        <div className="collaboration-stack">
          {loading ? (
            <PageState
              title="正在整理这一轮家庭协作"
              description="稍等一下，我把成员、待办任务和邀请码状态整合出来。"
            />
          ) : null}
          {error ? (
            <PageState
              variant="error"
              title="协作页暂时没连上本地服务"
              description={error}
            />
          ) : null}
          {inviteFeedback ? <p className="state-note">{inviteFeedback}</p> : null}

          <article className="relay-card">
            <p className="surface-card__eyebrow">家庭接力建议</p>
            <span className="status-pill">这一轮更适合谁来接</span>
            <strong>
              最近联系：
              {recentContact
                ? ` ${recentContact.displayName} · ${formatShortDateTime(recentContact.lastActivityAt)}`
                : ' 暂无记录'}
            </strong>
            <p>
              建议接力人：<strong>{suggestedRelay?.displayName ?? '暂无'}</strong>
            </p>
            <p>
              {suggestedRelay
                ? `${suggestedRelay.displayName} 最近较久没有和长辈产生有效互动，适合这次先接一句。`
                : '当前成员不足，暂时无法生成接力建议。'}
            </p>
            <div className="inline-actions">
              <button className="primary-action" type="button">
                提醒接力
              </button>
              <button className="ghost-action" type="button">
                重新看看分工
              </button>
            </div>
          </article>

          <article className="task-card">
            <p className="surface-card__eyebrow">当前协同任务</p>
            {alerts.length === 0 ? (
              <p className="state-note">当前没有待接手的异常提醒，协作状态比较平稳。</p>
            ) : (
              alerts.map((alert) => (
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
                        {handlingAlertId === alert.id ? '处理中…' : '我来跟进'}
                      </button>
                    ) : null}
                    {alert.status === 'HANDLING' ? (
                      <button
                        className="ghost-action"
                        type="button"
                        disabled={resolvingAlertId === alert.id}
                        onClick={() => void handleResolveAlert(alert.id)}
                      >
                        {resolvingAlertId === alert.id ? '关闭中…' : '关闭任务'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </article>

          <article className="members-card">
            <p className="surface-card__eyebrow">成员与权限</p>
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
            <p className="members-card__meta">紧急通知顺序：{alertOrder || '暂无'}</p>
            <div className="inline-actions">
              <button
                className="primary-action"
                type="button"
                disabled={creatingInvite}
                onClick={() => void handleCreateInvite()}
              >
                {creatingInvite ? '生成中…' : '生成家庭邀请码'}
              </button>
            </div>
            {activeInvite ? (
              <p className="members-card__meta">
                当前可用邀请码：<strong>{activeInvite.code}</strong>
              </p>
            ) : null}
          </article>

          <article className="members-card">
            <p className="surface-card__eyebrow">待审批加入</p>
            {pendingInvites.length === 0 ? (
              <p className="state-note">当前没有待审批的家庭码申请。</p>
            ) : (
              <div className="list-stack">
                {pendingInvites.map((invite) => (
                  <div className="list-row" key={invite.id}>
                    <div className="list-row__main">
                      <div>
                        <strong>{invite.code}</strong>
                        <p>申请角色：{invite.requestedRole}</p>
                      </div>
                    </div>
                    <button
                      className="ghost-action"
                      type="button"
                      disabled={approvingInviteId === invite.id}
                      onClick={() => void handleApproveInvite(invite.id)}
                    >
                      {approvingInviteId === invite.id ? '审批中…' : '批准'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </section>
  )

  async function handleCreateInvite() {
    try {
      setCreatingInvite(true)
      const invite = await createInviteCode({
        familySpaceId: 'fs_demo',
        requestedRole: 'Family',
        createdByMemberId: 'member_daughter',
      })
      const nextInvites = await listInviteCodes()
      setInvites(nextInvites)
      setInviteFeedback(`已生成新的家庭邀请码：${invite.code}`)
      setError('')
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : '生成邀请码失败')
    } finally {
      setCreatingInvite(false)
    }
  }

  async function handleApproveInvite(inviteId: string) {
    try {
      setApprovingInviteId(inviteId)
      await approveInviteCode(inviteId, 'member_daughter')
      const nextInvites = await listInviteCodes()
      setInvites(nextInvites)
      setInviteFeedback('已批准一个家庭码申请。')
      setError('')
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : '审批邀请码失败')
    } finally {
      setApprovingInviteId(null)
    }
  }

  async function handleAcknowledgeAlert(alertId: string) {
    try {
      setHandlingAlertId(alertId)
      await acknowledgeAlert(alertId, 'member_daughter')
      const nextAlerts = await listActiveAlerts()
      setAlerts(nextAlerts)
      setInviteFeedback('已接手一条求助任务。')
      setError('')
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : '接单失败')
    } finally {
      setHandlingAlertId(null)
    }
  }

  async function handleResolveAlert(alertId: string) {
    try {
      setResolvingAlertId(alertId)
      await resolveAlert(alertId, '已联系家人并完成当前处理。')
      const nextAlerts = await listActiveAlerts()
      setAlerts(nextAlerts)
      setInviteFeedback('已关闭一条求助任务。')
      setError('')
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : '关闭任务失败')
    } finally {
      setResolvingAlertId(null)
    }
  }
}

function toAlertSummary(alert: Alert) {
  if (alert.alertType === 'SOS') {
    return 'SOS 紧急求助'
  }

  return '身体不适 / 需要联系'
}

function toAlertStatus(alert: Alert) {
  if (alert.status === 'HANDLING') {
    return '已经有人接单处理中'
  }

  if (alert.status === 'TRIGGERED') {
    return '刚刚触发，等待认领'
  }

  return alert.status
}
