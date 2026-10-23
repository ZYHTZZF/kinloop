import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOnboardingState } from '../../app/onboardingStorage'
import { PageState } from '../../components/common/PageState'
import { getTodayEmotionStatus } from '../../services/api'
import type { TodayEmotionStatus } from '../../services/api'
import { formatShortDateTime } from '../../utils/dateTime'

export function FamilyTodayPage() {
  const [status, setStatus] = useState<TodayEmotionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewedTodayAlertKey, setViewedTodayAlertKey] = useState(() => readViewedTodayAlertKey())

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

  const todayPoint = useMemo(() => {
    if (!status) return null
    const todayKey = toDayKey(status.generatedAt)
    return status.trend.find((point) => point.dayKey === todayKey) ?? status.trend.at(-1) ?? null
  }, [status])

  const todayAbnormalCards = useMemo(() => {
    if (!status) return []
    const todayKey = toDayKey(status.generatedAt)
    return status.abnormalCards.filter((card) => toDayKey(card.happenedAt) === todayKey)
  }, [status])

  const todayAbnormalCount = todayPoint?.abnormalCount ?? 0
  const weeklyAbnormalCount = status?.abnormalCount ?? 0
  const todayAlertKey = status ? buildTodayAlertKey(status, todayAbnormalCount, todayAbnormalCards.map((card) => card.pulseId)) : ''
  const hasUnreadTodayAlert = todayAbnormalCount > 0 && todayAlertKey !== viewedTodayAlertKey
  function handleOpenTodayAlerts() {
    if (!todayAlertKey) return
    saveViewedTodayAlertKey(todayAlertKey)
    setViewedTodayAlertKey(todayAlertKey)
  }

  return (
    <section className="screen screen--family-today">
      <section className="surface-card surface-card--family-social">
        <div className="section-heading section-heading--family-social">
          <div>
            <p className="surface-card__eyebrow">今日</p>
            <h2>先看有没有需要留意的异常情绪</h2>
          </div>
        </div>

        {loading ? (
          <PageState
            title="正在整理今天的状态"
            description="稍等一下，我把需要优先关注的内容整理好。"
          />
        ) : null}
        {error ? <PageState variant="error" title="暂时无法查看今日状态" description={error} /> : null}

        {!loading && !error && status ? (
          <div className="family-today-simple">
            <Link
              className={`family-today-summary-card${hasUnreadTodayAlert ? ' family-today-summary-card--alert' : ''}`}
              to="/family/today/alerts"
              onClick={handleOpenTodayAlerts}
            >
              <span className="family-today-summary-card__label">今日异常情绪</span>
              <strong>{todayAbnormalCount}</strong>
              <small>{hasUnreadTodayAlert ? '有新的异常，点击查看' : todayAbnormalCount > 0 ? '已查看今日异常' : '今天暂无新增异常'}</small>
            </Link>

            <Link className="family-today-summary-card" to="/family/today/week">
              <span className="family-today-summary-card__label">近七天异常情绪</span>
              <strong>{weeklyAbnormalCount}</strong>
              <small>最近 {status.windowDays} 天累计</small>
            </Link>

            <p className="family-today-simple__updated">更新于 {formatShortDateTime(status.generatedAt)}</p>
          </div>
        ) : null}
      </section>
    </section>
  )
}

function buildTodayAlertKey(status: TodayEmotionStatus, todayAbnormalCount: number, todayPulseIds: string[]) {
  return [
    getTodayAlertStorageScope(),
    toDayKey(status.generatedAt),
    todayAbnormalCount,
    todayPulseIds.sort().join(','),
  ].join(':')
}

function getTodayAlertStorageScope() {
  const state = getOnboardingState()
  return [state.userId || 'guest', state.familyId || 'family', state.memberId || 'member'].join(':')
}

function getViewedTodayAlertStorageKey() {
  return `kinloop:family-today-viewed-alert:${getTodayAlertStorageScope()}`
}

function readViewedTodayAlertKey() {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(getViewedTodayAlertStorageKey()) ?? ''
  } catch {
    return ''
  }
}

function saveViewedTodayAlertKey(value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(getViewedTodayAlertStorageKey(), value)
  } catch {
    // Ignore storage failures; the card will simply keep showing the alert color.
  }
}

function toDayKey(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
