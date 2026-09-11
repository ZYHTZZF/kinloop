import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { careActions } from '../../domain/content/careGuidance'
import { statusItems } from '../../domain/content/statusSignals'
import { createFollowup, listTodayPulses } from '../../services/api'
import type { Pulse } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

export function FamilyTodayPage() {
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [handlingPulseId, setHandlingPulseId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPulses() {
      try {
        const nextPulses = await listTodayPulses()
        if (!cancelled) {
          setPulses(nextPulses)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载今日状态失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPulses()

    return () => {
      cancelled = true
    }
  }, [])

  const mediumOrHighCount = useMemo(
    () => pulses.filter((pulse) => pulse.severity !== 'LOW').length,
    [pulses],
  )
  const resolvedCount = useMemo(
    () => pulses.filter((pulse) => pulse.status === 'RESOLVED').length,
    [pulses],
  )

  return (
    <section className="screen screen--family-today">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">今天</p>
            <h2>先知道妈妈今天怎么样，再决定现在最适合做什么。</h2>
          </div>
          <span className="status-pill">待办 {mediumOrHighCount}</span>
        </div>

        <div className="today-overview-strip">
          <div className="today-overview-chip">
            <span>今日脉冲</span>
            <strong>{pulses.length}</strong>
          </div>
          <div className="today-overview-chip">
            <span>待跟进</span>
            <strong>{mediumOrHighCount}</strong>
          </div>
          <div className="today-overview-chip">
            <span>已闭环</span>
            <strong>{resolvedCount}</strong>
          </div>
        </div>

        <div className="family-today__hero-grid">
          <article className="action-suggestion-card">
            <p className="surface-card__eyebrow">建议动作</p>
            <strong>妈妈今天还没跟人说过话。</strong>
            <p>建议先发一条短语音，不需要追问太多，先让她感觉到你记得她。</p>
            <div className="inline-actions">
              <Link className="primary-action" to="/family/chats/daughter">
                发条短语音
              </Link>
              <button className="ghost-action" type="button">
                打个电话
              </button>
            </div>
          </article>

          <article className="status-summary-card">
            <div className="metric-pair">
              <div>
                <span>今日互动</span>
                <strong>{pulses.length} 次</strong>
              </div>
              <div>
                <span>当前情绪</span>
                <strong>{mediumOrHighCount > 0 ? '需要关注' : '偏平稳'}</strong>
              </div>
              <div>
                <span>最近提及</span>
                <strong>{pulses[0]?.summary ?? '今天还没有新的状态'}</strong>
              </div>
            </div>
          </article>
        </div>

        <div className="split-grid">
          {careActions.map((item) => (
            <article className="support-card" key={item.label}>
              <p className="surface-card__eyebrow">{item.label}</p>
              <strong>{item.note}</strong>
            </article>
          ))}
        </div>

        <section className="pulse-section">
          <div className="section-heading">
            <div>
              <p className="surface-card__eyebrow">今日动态</p>
              <h2>状态脉冲</h2>
            </div>
            <Link className="ghost-action ghost-action--link" to="/family/status">
              查看全部
            </Link>
          </div>

          <div className="list-stack">
            {loading ? (
              <PageState
                title="正在整理今天的关怀判断"
                description="稍等一下，我把今天值得先看的状态脉冲排在前面。"
              />
            ) : null}
            {error ? (
              <PageState
                variant="error"
                title="今天页暂时没有连上本地服务"
                description={error}
              />
            ) : null}
            {!loading && !error && pulses.length === 0 ? (
              <PageState
                title="今天还没有新的状态脉冲"
                description="可以先发一条问候，或者稍后再回来看看。"
              />
            ) : null}

            {pulses.map((pulse) => (
              <article className="pulse-row" key={pulse.id}>
                <div className="pulse-row__main">
                  <span className={`severity-dot severity-dot--${toSeverityTone(pulse.severity)}`} />
                  <div>
                    <strong>{pulse.summary}</strong>
                    <p>{formatClock(pulse.createdAt)}</p>
                  </div>
                </div>
                {pulse.severity !== 'LOW' && pulse.status !== 'RESOLVED' ? (
                  <button
                    className="ghost-action"
                    type="button"
                    disabled={handlingPulseId === pulse.id}
                    onClick={() => void handleFollowup(pulse)}
                  >
                    {handlingPulseId === pulse.id ? '处理中…' : '我来跟进'}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="signal-section">
          <div className="section-heading">
            <div>
              <p className="surface-card__eyebrow">最近线索</p>
              <h2>这几条内容最值得帮助你判断“为什么是现在”。</h2>
            </div>
          </div>

          <div className="list-stack">
            {statusItems.map((item) => (
              <article className="signal-row" key={`${item.time}-${item.title}`}>
                <span>{item.time}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </section>
  )

  async function handleFollowup(pulse: Pulse) {
    try {
      setHandlingPulseId(pulse.id)
      await createFollowup({
        linkedPulseId: pulse.id,
        handlerMemberId: 'member_daughter',
        actionType: 'Call',
        resultTag: pulse.severity === 'HIGH' ? '已优先回电' : '已跟进',
        resultNote:
          pulse.severity === 'HIGH'
            ? '已电话确认当前情况，后续继续观察。'
            : '已发起一次轻量联系，后续视反馈再跟进。',
      })

      const nextPulses = await listTodayPulses()
      setPulses(nextPulses)
      setError('')
    } catch (followupError) {
      setError(followupError instanceof Error ? followupError.message : '创建回访失败')
    } finally {
      setHandlingPulseId(null)
    }
  }
}

function toSeverityTone(severity: string) {
  if (severity === 'HIGH') return 'high'
  if (severity === 'MEDIUM') return 'medium'
  return 'low'
}
