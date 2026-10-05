import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { listPulseHistory } from '../../services/api'
import type { Pulse } from '../../services/api'
import { formatClock, formatShortDate } from '../../utils/dateTime'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function FamilyTodayPage() {
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadPulses() {
      try {
        const nextPulses = await listPulseHistory()
        if (!cancelled) {
          setPulses(nextPulses)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载情绪状态失败')
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

  const now = Date.now()
  const weeklyPulses = useMemo(
    () => pulses.filter((pulse) => now - pulse.createdAt <= WEEK_MS),
    [now, pulses],
  )
  const abnormalPulses = useMemo(
    () =>
      weeklyPulses
        .filter((pulse) => pulse.pulseType === 'Emotion' && pulse.severity !== 'LOW')
        .slice(0, 3),
    [weeklyPulses],
  )
  const weeklyEmotionPulses = useMemo(
    () => weeklyPulses.filter((pulse) => pulse.pulseType === 'Emotion'),
    [weeklyPulses],
  )

  const weeklySummary = useMemo(() => {
    const summary = {
      total: weeklyEmotionPulses.length,
      abnormal: weeklyEmotionPulses.filter((pulse) => pulse.severity !== 'LOW').length,
      text: 0,
      voice: 0,
      face: 0,
    }

    for (const pulse of weeklyEmotionPulses) {
      if (pulse.emotionSource === 'voice_tone') {
        summary.voice += 1
      } else if (pulse.emotionSource === 'face') {
        summary.face += 1
      } else {
        summary.text += 1
      }
    }

    return summary
  }, [weeklyEmotionPulses])

  return (
    <section className="screen screen--family-today">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">首页概览</p>
          </div>
          <Link className="primary-action" to="/family/chats">
            去聊天窗口
          </Link>
        </div>

        {loading ? (
          <PageState title="正在整理本周情绪状态" description="稍等一下，我在汇总异常情绪和周统计。" />
        ) : null}
        {error ? (
          <PageState variant="error" title="首页暂时没连上本地服务" description={error} />
        ) : null}

        {!loading && !error ? (
          <div className="family-emotion-dashboard">
            <article className="family-emotion-panel family-emotion-panel--alert">
              <div className="section-heading">
                <div>
                  <p className="surface-card__eyebrow">异常情绪</p>
                  <h2>需要优先关注的情绪变化</h2>
                </div>
                <span className="status-pill">近 7 天 {abnormalPulses.length} 条</span>
              </div>

              {abnormalPulses.length === 0 ? (
                <div className="family-emotion-empty">
                  <strong>本周没有新的异常情绪</strong>
                  <p>首页会保持简洁，只有出现需要关注的变化时才在这里提示。</p>
                </div>
              ) : (
                <div className="family-emotion-alert-grid">
                  {abnormalPulses.map((pulse) => (
                    <article className="family-emotion-alert-card" key={pulse.id}>
                      <span className={`status-pill status-pill--${toSeverityTone(pulse.severity)}`}>
                        {getSeverityLabel(pulse.severity)}
                      </span>
                      <strong>{formatPulseSummary(pulse.summary)}</strong>
                      <p>{getEmotionSourceLabel(pulse.emotionSource)}</p>
                      {isMeaningfulExcerpt(pulse.sourceExcerpt) ? (
                        <blockquote className="family-emotion-quote">“{pulse.sourceExcerpt}”</blockquote>
                      ) : null}
                      <div className="family-emotion-alert-meta">
                        <span>{formatShortDate(pulse.createdAt)} {formatClock(pulse.createdAt)}</span>
                        {pulse.sourceConversationId ? (
                          <Link className="ghost-action ghost-action--link" to={`/family/chats/${pulse.sourceConversationId}`}>
                            查看原聊天
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="family-emotion-panel family-emotion-panel--summary">
              <div className="section-heading">
                <div>
                  <p className="surface-card__eyebrow">每周汇总</p>
                  <h2>本周情绪识别概览</h2>
                </div>
              </div>

              <div className="family-emotion-summary-grid">
                <div className="family-emotion-summary-card">
                  <span>情绪识别总数</span>
                  <strong>{weeklySummary.total}</strong>
                </div>
                <div className="family-emotion-summary-card">
                  <span>异常情绪</span>
                  <strong>{weeklySummary.abnormal}</strong>
                </div>
                <div className="family-emotion-summary-card">
                  <span>文本情绪</span>
                  <strong>{weeklySummary.text}</strong>
                </div>
                <div className="family-emotion-summary-card">
                  <span>语气情绪</span>
                  <strong>{weeklySummary.voice}</strong>
                </div>
                <div className="family-emotion-summary-card">
                  <span>表情情绪</span>
                  <strong>{weeklySummary.face}</strong>
                </div>
              </div>

              <div className="family-emotion-summary-note">
                <strong>查看方式已调整</strong>
                <p>首页只保留异常情绪和周汇总，具体是哪一句话的情绪，请回到子女端聊天窗口查看。</p>
              </div>
            </article>
          </div>
        ) : null}
      </section>
    </section>
  )
}

function toSeverityTone(severity: string) {
  if (severity === 'HIGH') return 'high'
  if (severity === 'MEDIUM') return 'medium'
  return 'low'
}

function getSeverityLabel(severity: string) {
  if (severity === 'HIGH') return '高风险'
  if (severity === 'MEDIUM') return '需关注'
  return '一般'
}

function getEmotionSourceLabel(source: string | null | undefined) {
  if (source === 'voice_tone') return '语气情绪'
  if (source === 'text_fallback') return '语气降级到文本情绪'
  if (source === 'text') return '文本情绪'
  if (source === 'face') return '表情情绪'
  return '情绪识别'
}

function isMeaningfulExcerpt(excerpt: string | null | undefined) {
  if (!excerpt) return false
  const normalized = excerpt.trim()
  if (!normalized) return false
  return !/^[?\uff1f]+$/.test(normalized)
}

function formatPulseSummary(summary: string) {
  return summary.replace('fallback:neutral', '平稳').replace('：neutral', '：平稳')
}
