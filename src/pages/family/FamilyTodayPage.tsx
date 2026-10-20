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
      } catch {
        if (!cancelled) {
          setError('今天的状态暂时还没有同步出来，请稍后再试。')
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
  const topAlerts = abnormalCards.slice(0, 3)
  const topTrend = trend.slice(0, 4)

  return (
    <section className="screen screen--family-today">
      <section className="surface-card surface-card--family-social">
        <div className="section-heading section-heading--family-social">
          <div>
            <p className="surface-card__eyebrow">今日概览</p>
            <h2>先看最需要回应的变化</h2>
          </div>
          <div className="inline-actions">
            <Link className="ghost-action ghost-action--link" to="/family/status">
              查看记录
            </Link>
            <Link className="primary-action" to="/family/chats">
              去聊天
            </Link>
          </div>
        </div>

        {loading ? (
          <PageState
            title="正在整理今天的状态"
            description="稍等一下，我先把需要优先关注的内容排好。"
          />
        ) : null}
        {error ? <PageState variant="error" title="暂时无法查看今日状态" description={error} /> : null}

        {!loading && !error && status ? (
          <div className="family-social-home">
            <section className="family-social-hero">
              <div className="family-social-hero__copy">
                <p className="surface-card__eyebrow">今日结论</p>
                <h3>{getHeroTitle(status)}</h3>
                <p>{status.stableSummary}</p>
              </div>

              <div className="family-social-hero__stats">
                <article className="family-social-stat">
                  <span>需要留意</span>
                  <strong>{status.abnormalCount}</strong>
                  <small>今天优先处理</small>
                </article>
                <article className="family-social-stat">
                  <span>最近线索</span>
                  <strong>{status.totalEmotionCount}</strong>
                  <small>近 {status.windowDays} 天累计</small>
                </article>
                <article className="family-social-stat">
                  <span>更新时间</span>
                  <strong>{formatShortDateTime(status.generatedAt)}</strong>
                  <small>刚刚整理完成</small>
                </article>
              </div>
            </section>

            <section className="family-social-quickbar">
              <Link className="family-social-quickbar__item" to="/family/chats">
                <strong>去联系家人</strong>
                <span>直接进入聊天，先回应当下情绪</span>
              </Link>
              <Link className="family-social-quickbar__item" to="/family/status">
                <strong>看跟进记录</strong>
                <span>把已经处理过的提醒接着跟完</span>
              </Link>
            </section>

            <section className="family-social-section">
              <div className="family-social-section__header">
                <div>
                  <p className="surface-card__eyebrow">重点处理</p>
                  <h3>今天建议先看这几条</h3>
                </div>
                <span className="status-pill">{topAlerts.length} 条重点</span>
              </div>

              {topAlerts.length === 0 ? (
                <div className="family-social-empty">
                  <strong>今天没有新的高优先级提醒</strong>
                  <p>可以按平常节奏聊一聊，保持陪伴就很好。</p>
                </div>
              ) : (
                <div className="family-social-focus-list">
                  {topAlerts.map((card) => (
                    <article className="family-social-focus-card" key={card.pulseId}>
                      <div className="family-social-focus-card__top">
                        <div className="family-social-focus-card__tags">
                          <span className={`status-pill status-pill--${toSeverityTone(card.severity)}`}>
                            {card.severityLabel}
                          </span>
                          <span className="family-emotion-source-chip">{card.sourceLabel}</span>
                        </div>
                        <span className="family-social-focus-card__time">{formatShortDateTime(card.happenedAt)}</span>
                      </div>

                      <strong>{card.summary}</strong>
                      <p>{card.actionSuggestion}</p>

                      <div className="family-social-focus-card__actions">
                        {card.sourceConversationId ? (
                          <Link
                            className="ghost-action ghost-action--link"
                            to={`/family/chats/${card.sourceConversationId}${card.sourceMessageId ? `?messageId=${encodeURIComponent(card.sourceMessageId)}` : ''}`}
                          >
                            查看原聊天
                          </Link>
                        ) : null}
                        <Link
                          className="ghost-action ghost-action--link"
                          to={`/family/status?pulseId=${encodeURIComponent(card.pulseId)}`}
                        >
                          去跟进
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div className="family-social-grid">
              <section className="family-social-section">
                <div className="family-social-section__header">
                  <div>
                    <p className="surface-card__eyebrow">最近趋势</p>
                    <h3>近几天的变化节奏</h3>
                  </div>
                </div>
                <div className="family-social-trend-grid">
                  {topTrend.map((point) => (
                    <article className="family-social-trend-card" key={point.dayKey}>
                      <div className="family-social-trend-card__top">
                        <strong>{point.dateLabel}</strong>
                        <span className={`status-pill status-pill--${toSeverityTone(point.highestSeverity)}`}>
                          {point.dominantLabelText}
                        </span>
                      </div>
                      <p>{point.summary}</p>
                      <div className="family-social-trend-card__meta">
                        <span>线索 {point.totalCount}</span>
                        <span>重点 {point.abnormalCount}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="family-social-section">
                <div className="family-social-section__header">
                  <div>
                    <p className="surface-card__eyebrow">信息来源</p>
                    <h3>今天主要依据这些内容</h3>
                  </div>
                </div>
                <div className="family-social-source-grid">
                  {sourceItems.map((item) => (
                    <SourceBreakdownCard key={item.source} item={item} />
                  ))}
                </div>
                <p className="family-social-section__note">{status.sourceBreakdown.note}</p>
              </section>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  )
}

function SourceBreakdownCard({ item }: { item: TodayEmotionSourceBreakdownItem }) {
  return (
    <article className="family-social-source-card">
      <span>{item.label}</span>
      <strong>{toPercentLabel(item.ratio)}</strong>
      <small>{item.count} 条相关内容</small>
    </article>
  )
}

function getHeroTitle(status: TodayEmotionStatus) {
  if (status.abnormalCount >= 3) return '今天有几条内容需要优先回应'
  if (status.abnormalCount > 0) return '今天有一两条变化值得先看'
  return '今天整体比较平稳'
}

function toPercentLabel(ratio: number) {
  return `${Math.round(ratio * 100)}%`
}

function toSeverityTone(severity: string) {
  if (severity === 'HIGH') return 'high'
  if (severity === 'MEDIUM') return 'medium'
  return 'low'
}
