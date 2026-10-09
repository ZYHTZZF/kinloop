import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { closureActions, followupTasks } from '../../domain/content/followupGuidance'
import { createFollowup, listFollowups, listPulseHistory } from '../../services/api'
import type { FollowupRecord, Pulse } from '../../services/api'
import { formatShortDateTime } from '../../utils/dateTime'

export function FamilyStatusPage() {
  const [searchParams] = useSearchParams()
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [followups, setFollowups] = useState<FollowupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [closingPulseId, setClosingPulseId] = useState<string | null>(null)
  const focusPulseId = searchParams.get('pulseId')

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      try {
        const [nextPulses, nextFollowups] = await Promise.all([
          listPulseHistory(),
          listFollowups(),
        ])

        if (!cancelled) {
          setPulses(nextPulses)
          setFollowups(nextFollowups)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载状态历史失败。')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadStatus()

    return () => {
      cancelled = true
    }
  }, [])

  const followupByPulseId = useMemo(() => {
    const map = new Map<string, FollowupRecord>()
    for (const item of followups) {
      if (item.linkedPulseId) {
        map.set(item.linkedPulseId, item)
      }
    }
    return map
  }, [followups])

  const orderedPulses = useMemo(() => {
    if (!focusPulseId) return pulses
    return [...pulses].sort((a, b) => {
      if (a.id === focusPulseId) return -1
      if (b.id === focusPulseId) return 1
      return Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0)
    })
  }, [focusPulseId, pulses])

  return (
    <section className="screen screen--family-status">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">状态与跟进</p>
            <h2>把已经看到的变化转成一次具体回应，并把结果留在家庭协作里。</h2>
          </div>
          <Link className="primary-action" to="/family/chats">
            去聊天窗口
          </Link>
        </div>

        <div className="trend-card">
          <strong>先看异常，再补记录</strong>
          <p>如果你是从今日状态跳转过来的，这里会优先把那条需要跟进的事件放到最前面。</p>
        </div>

        {focusPulseId ? (
          <div className="family-status-focus-note">
            <strong>已为你定位到本次建议跟进的情绪事件。</strong>
            <p>完成一次联系后，可以直接点“快速记录”，让家人知道这条变化已经有人接住。</p>
          </div>
        ) : null}

        <div className="timeline-stack">
          {loading ? (
            <PageState
              title="正在整理最近的状态与跟进"
              description="我会把近几次需要回应的状态变化和已经完成的处理结果串成一条时间线。"
            />
          ) : null}
          {error ? (
            <PageState variant="error" title="状态历史暂时没有连上本地服务" description={error} />
          ) : null}
          {!loading && !error && orderedPulses.length === 0 ? (
            <PageState
              title="现在还没有可回看的状态记录"
              description="等第一条状态脉冲和跟进结果产生后，这里会形成完整的协作时间线。"
            />
          ) : null}

          {orderedPulses.map((pulse) => {
            const followup = followupByPulseId.get(pulse.id)
            const isFocused = pulse.id === focusPulseId

            return (
              <article
                className={`timeline-card${isFocused ? ' timeline-card--focused' : ''}`}
                key={pulse.id}
              >
                <div className="timeline-card__pulse">
                  <span className={`severity-dot severity-dot--${toSeverityTone(pulse.severity)}`} />
                  <div>
                    <strong>{pulse.summary}</strong>
                    <p>{formatShortDateTime(pulse.createdAt)}</p>
                  </div>
                </div>

                {followup ? (
                  <div className="timeline-card__followup">
                    {followup.resultTag ? <span className="status-pill">{followup.resultTag}</span> : null}
                    <p>{followup.resultNote ?? '已完成一次跟进记录。'}</p>
                    <small>处理人：{followup.handlerMemberId}</small>
                  </div>
                ) : pulse.status !== 'RESOLVED' ? (
                  <div className="timeline-card__followup">
                    <p>这条状态还没有形成跟进记录，可以先联系，再把本次结果补进来。</p>
                    <div className="inline-actions">
                      <button
                        className="ghost-action"
                        type="button"
                        disabled={closingPulseId === pulse.id}
                        onClick={() => void handleClosePulse(pulse)}
                      >
                        {closingPulseId === pulse.id ? '提交中...' : '快速记录'}
                      </button>
                      {pulse.sourceConversationId ? (
                        <Link
                          className="ghost-action ghost-action--link"
                          to={`/family/chats/${pulse.sourceConversationId}`}
                        >
                          去聊天
                        </Link>
                      ) : (
                        <Link className="ghost-action ghost-action--link" to="/family/chats">
                          去聊天
                        </Link>
                      )}
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>

        <div className="split-grid">
          <article className="support-card">
            <p className="surface-card__eyebrow">轻量跟进动作</p>
            <div className="list-stack">
              {followupTasks.map((task) => (
                <div className="signal-row" key={task.label}>
                  <strong>{task.label}</strong>
                  <p>{task.detail}</p>
                  <small>{task.outcome}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="support-card">
            <p className="surface-card__eyebrow">记录原则</p>
            <div className="list-stack">
              {closureActions.map((item) => (
                <div className="signal-row" key={item.label}>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </section>
  )

  async function handleClosePulse(pulse: Pulse) {
    try {
      setClosingPulseId(pulse.id)
      await createFollowup({
        linkedPulseId: pulse.id,
        handlerMemberId: 'member_daughter',
        actionType: 'Chat',
        resultTag: '已记录',
        resultNote: '已完成一次轻量跟进，并把结果补进状态闭环。',
      })

      const [nextPulses, nextFollowups] = await Promise.all([
        listPulseHistory(),
        listFollowups(),
      ])
      setPulses(nextPulses)
      setFollowups(nextFollowups)
      setError('')
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : '跟进记录失败。')
    } finally {
      setClosingPulseId(null)
    }
  }
}

function toSeverityTone(severity: string) {
  if (severity === 'HIGH') return 'high'
  if (severity === 'MEDIUM') return 'medium'
  return 'low'
}
