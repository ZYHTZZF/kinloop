import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { getTodayEmotionStatus } from '../../services/api'
import type { TodayEmotionSourceBreakdownItem, TodayEmotionStatus } from '../../services/api'
import { formatShortDateTime } from '../../utils/dateTime'

export function FamilyTodayPage() {
  const [status, setStatus] = useState<TodayEmotionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadTodayStatus() {
      try {
        const nextStatus = await getTodayEmotionStatus()
        if (!cancelled) {
          setStatus(nextStatus)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载今日状态失败。')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadTodayStatus()

    return () => {
      cancelled = true
    }
  }, [])

  const trend = useMemo(() => status?.trend ?? [], [status])
  const abnormalCards = useMemo(() => status?.abnormalCards ?? [], [status])
  const sourceItems = useMemo(() => status?.sourceBreakdown.items ?? [], [status])

  return (
    <section className="screen screen--family-today">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">今日状态</p>
            <h2>把零散情绪线索整理成家人今天更容易做决定的关怀视图。</h2>
          </div>
          <div className="inline-actions">
            <Link className="ghost-action ghost-action--link" to="/family/status">
              去跟进记录
            </Link>
            <Link className="primary-action" to="/family/chats">
              去聊天窗口
            </Link>
          </div>
        </div>

        {loading ? (
          <PageState
            title="正在整理近 7 天的情绪变化"
            description="我会把趋势、需要优先关注的事件，以及判断来源一起整理出来。"
          />
        ) : null}
        {error ? (
          <PageState
            variant="error"
            title="今日状态暂时没有连上本地服务"
            description={error}
          />
        ) : null}

        {!loading && !error && status ? (
          <div className="family-emotion-layout">
            <article className="family-emotion-panel family-emotion-panel--hero">
              <div className="family-emotion-hero">
                <div>
                  <p className="surface-card__eyebrow">关怀建议</p>
                  <strong>{status.stableSummary}</strong>
                </div>
                <div className="family-emotion-summary-grid">
                  <div className="family-emotion-summary-card">
                    <span>近 7 天情绪线索</span>
                    <strong>{status.totalEmotionCount}</strong>
                  </div>
                  <div className="family-emotion-summary-card">
                    <span>建议优先关注</span>
                    <strong>{status.abnormalCount}</strong>
                  </div>
                </div>
              </div>
            </article>

            <article className="family-emotion-panel family-emotion-panel--alert">
              <div className="section-heading">
                <div>
                  <p className="surface-card__eyebrow">建议优先关注</p>
                  <h2>先处理需要回应的变化，再决定今天谁来跟进。</h2>
                </div>
                <span className="status-pill">近 7 天 {abnormalCards.length} 条</span>
              </div>

              {abnormalCards.length === 0 ? (
                <div className="family-emotion-empty">
                  <strong>最近没有新的优先关注事件</strong>
                  <p>这几天整体较平稳，可以继续保持自然问候和日常陪伴。</p>
                </div>
              ) : (
                <div className="family-emotion-alert-grid">
                  {abnormalCards.map((card) => (
                    <article className="family-emotion-alert-card" key={card.pulseId}>
                      <div className="family-emotion-alert-head">
                        <span className={`status-pill status-pill--${toSeverityTone(card.severity)}`}>
                          {card.severityLabel}
                        </span>
                        <span className="family-emotion-source-chip">{card.sourceLabel}</span>
                      </div>
                      <strong>{card.summary}</strong>
                      <p>{card.attentionSuggestion}</p>
                      {card.sourceExcerpt ? (
                        <blockquote className="family-emotion-quote">“{card.sourceExcerpt}”</blockquote>
                      ) : null}
                      <div className="family-emotion-action-note">
                        <span>建议行动</span>
                        <p>{card.actionSuggestion}</p>
                      </div>
                      <div className="family-emotion-alert-meta">
                        <span>{formatShortDateTime(card.happenedAt)}</span>
                        <div className="inline-actions">
                          {card.sourceConversationId ? (
                            <Link
                              className="ghost-action ghost-action--link"
                              to={`/family/chats/${card.sourceConversationId}`}
                            >
                              查看原聊天
                            </Link>
                          ) : null}
                          <Link
                            className="ghost-action ghost-action--link"
                            to={`/family/status?pulseId=${encodeURIComponent(card.pulseId)}`}
                          >
                            去跟进记录
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article className="family-emotion-panel">
              <div className="section-heading">
                <div>
                  <p className="surface-card__eyebrow">近 7 天趋势</p>
                  <h2>帮助家人看变化，不只看某一次异常。</h2>
                </div>
              </div>

              <div className="family-emotion-trend-grid">
                {trend.map((point) => (
                  <article className="family-emotion-trend-card" key={point.dayKey}>
                    <div className="family-emotion-trend-head">
                      <strong>{point.dateLabel}</strong>
                      <span className={`status-pill status-pill--${toSeverityTone(point.highestSeverity)}`}>
                        {point.dominantLabelText}
                      </span>
                    </div>
                    <div className="family-emotion-trend-stats">
                      <span>线索 {point.totalCount}</span>
                      <span>需关注 {point.abnormalCount}</span>
                    </div>
                    <p>{point.summary}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className="family-emotion-panel">
              <div className="section-heading">
                <div>
                  <p className="surface-card__eyebrow">来源说明</p>
                  <h2>让家人知道判断主要来自哪里，结论更容易理解。</h2>
                </div>
              </div>

              <div className="family-emotion-source-grid">
                {sourceItems.map((item) => (
                  <SourceBreakdownCard key={item.source} item={item} />
                ))}
              </div>

              <div className="family-emotion-summary-note">
                <strong>结论来源说明</strong>
                <p>{status.sourceBreakdown.note}</p>
              </div>
            </article>
          </div>
        ) : null}
      </section>
    </section>
  )
}

function SourceBreakdownCard({ item }: { item: TodayEmotionSourceBreakdownItem }) {
  return (
    <article className="family-emotion-source-card">
      <span>{item.label}</span>
      <strong>{toPercentLabel(item.ratio)}</strong>
      <p>{item.count} 条相关线索</p>
    </article>
  )
}

function toPercentLabel(ratio: number) {
  return `${Math.round(ratio * 100)}%`
}

function toSeverityTone(severity: string) {
  if (severity === 'HIGH') return 'high'
  if (severity === 'MEDIUM') return 'medium'
  return 'low'
}
