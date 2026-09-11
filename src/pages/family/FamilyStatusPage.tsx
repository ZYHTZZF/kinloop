import { useEffect, useMemo, useState } from 'react'
import { PageState } from '../../components/common/PageState'
import { closureActions, followupTasks } from '../../domain/content/followupGuidance'
import { createFollowup, listFollowups, listPulseHistory } from '../../services/api'
import type { FollowupRecord, Pulse } from '../../services/api'
import { formatShortDateTime } from '../../utils/dateTime'

export function FamilyStatusPage() {
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [followups, setFollowups] = useState<FollowupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [closingPulseId, setClosingPulseId] = useState<string | null>(null)

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
          setError(loadError instanceof Error ? loadError.message : '加载状态历史失败')
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

  return (
    <section className="screen screen--family-status">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">状态与回访</p>
            <h2>把今天看到的问题，和已经做过的跟进，串成一条能回看的线。</h2>
          </div>
        </div>

        <div className="trend-card">
          <strong>本周互动健康度</strong>
          <p>本周平均每天 2 次有效互动，昨天完成了 2 次回访闭环。</p>
        </div>

        <div className="timeline-stack">
          {loading ? (
            <PageState
              title="正在回看最近的状态与回访"
              description="我会把今天和昨天的判断、跟进结果整理成一条能回看的线。"
            />
          ) : null}
          {error ? (
            <PageState
              variant="error"
              title="状态历史暂时没有连上本地服务"
              description={error}
            />
          ) : null}
          {!loading && !error && pulses.length === 0 ? (
            <PageState
              title="现在还没有可回看的状态记录"
              description="等第一条状态脉冲和回访记录产生后，这里会形成完整时间线。"
            />
          ) : null}

          {pulses.map((pulse) => {
            const followup = followupByPulseId.get(pulse.id)

            return (
            <article className="timeline-card" key={pulse.id}>
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
                  <p>{followup.resultNote ?? '已完成跟进'}</p>
                  <small>处理人：{followup.handlerMemberId}</small>
                </div>
              ) : pulse.status !== 'RESOLVED' ? (
                <div className="timeline-card__followup">
                  <p>这条状态还没有形成回访记录。</p>
                  <div className="inline-actions">
                    <button
                      className="ghost-action"
                      type="button"
                      disabled={closingPulseId === pulse.id}
                      onClick={() => void handleClosePulse(pulse)}
                    >
                      {closingPulseId === pulse.id ? '提交中…' : '快速闭环'}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
            )
          })}
        </div>

        <div className="split-grid">
          <article className="support-card">
            <p className="surface-card__eyebrow">轻量回访动作</p>
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
            <p className="surface-card__eyebrow">闭环原则</p>
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
        resultNote: '已完成一次轻量回访，并把结果补进状态闭环。',
      })

      const [nextPulses, nextFollowups] = await Promise.all([
        listPulseHistory(),
        listFollowups(),
      ])
      setPulses(nextPulses)
      setFollowups(nextFollowups)
      setError('')
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : '回访闭环失败')
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
