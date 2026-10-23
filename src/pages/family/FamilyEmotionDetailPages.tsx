import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { getTodayEmotionStatus, listPulseHistory } from '../../services/api'
import type { Pulse, TodayEmotionStatus } from '../../services/api'
import { formatShortDateTime } from '../../utils/dateTime'

export function FamilyTodayEmotionPage() {
  const navigate = useNavigate()
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const nextPulses = await listPulseHistory()
        if (!cancelled) {
          setPulses(nextPulses)
          setError('')
        }
      } catch {
        if (!cancelled) {
          setError('今天的异常情绪暂时没有加载出来，请稍后再试。')
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

  const todayKey = toDayKey(Date.now())
  const todayPulses = useMemo(() => filterAbnormalPulsesByDay(pulses, todayKey), [pulses, todayKey])

  return (
    <EmotionDetailShell eyebrow="今日异常" title="今天需要留意的情绪消息" onBack={() => navigate(-1)}>
      <EmotionPulseList
        loading={loading}
        error={error}
        pulses={todayPulses}
        emptyTitle="今天暂无异常情绪"
        emptyDescription="如果后续识别到新的异常，这里会列出对应的情绪消息。"
      />
    </EmotionDetailShell>
  )
}

export function FamilyWeeklyEmotionPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<TodayEmotionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const nextStatus = await getTodayEmotionStatus()
        if (!cancelled) {
          setStatus(nextStatus)
          setError('')
        }
      } catch {
        if (!cancelled) {
          setError('近七天统计暂时没有加载出来，请稍后再试。')
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

  const maxCount = Math.max(1, ...(status?.trend ?? []).map((item) => item.abnormalCount))

  return (
    <EmotionDetailShell eyebrow="近七天" title="近七天异常情绪统计" onBack={() => navigate(-1)}>
      {loading ? <PageState title="正在整理近七天统计" description="稍等一下，我把每天的异常数量排出来。" /> : null}
      {error ? <PageState variant="error" title="暂时无法查看近七天统计" description={error} /> : null}

      {!loading && !error && status ? (
        <div className="family-emotion-week-chart">
          {status.trend.map((point) => (
            <Link className="family-emotion-bar-row" key={point.dayKey} to={`/family/today/day/${point.dayKey}`}>
              <span className="family-emotion-bar-row__date">{point.dateLabel}</span>
              <span className="family-emotion-bar-row__track" aria-hidden="true">
                <span
                  className={`family-emotion-bar-row__bar${point.abnormalCount > 0 ? ' family-emotion-bar-row__bar--active' : ''}`}
                  style={{ width: `${Math.max(4, (point.abnormalCount / maxCount) * 100)}%` }}
                />
              </span>
              <strong>{point.abnormalCount}</strong>
            </Link>
          ))}
        </div>
      ) : null}
    </EmotionDetailShell>
  )
}

export function FamilyEmotionDayPage() {
  const navigate = useNavigate()
  const { dayKey = '' } = useParams()
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const nextPulses = await listPulseHistory()
        if (!cancelled) {
          setPulses(nextPulses)
          setError('')
        }
      } catch {
        if (!cancelled) {
          setError('这一天的情绪消息暂时没有加载出来，请稍后再试。')
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

  const dayPulses = useMemo(() => filterAbnormalPulsesByDay(pulses, dayKey), [dayKey, pulses])

  return (
    <EmotionDetailShell eyebrow="异常详情" title={`${formatDayTitle(dayKey)}的情绪消息`} onBack={() => navigate(-1)}>
      <EmotionPulseList
        loading={loading}
        error={error}
        pulses={dayPulses}
        emptyTitle="这一天暂无异常情绪"
        emptyDescription="点击近七天统计里的其他日期，可以切换查看对应日期。"
      />
    </EmotionDetailShell>
  )
}

function EmotionDetailShell({
  eyebrow,
  title,
  children,
  onBack,
}: {
  eyebrow: string
  title: string
  children: ReactNode
  onBack: () => void
}) {
  return (
    <section className="screen screen--family-emotion-detail">
      <section className="surface-card">
        <div className="section-heading family-subpage-heading">
          <button className="back-link family-subpage-back" type="button" onClick={onBack}>
            ‹ 返回
          </button>
          <div>
            <p className="surface-card__eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
        </div>
        {children}
      </section>
    </section>
  )
}

function EmotionPulseList({
  loading,
  error,
  pulses,
  emptyTitle,
  emptyDescription,
}: {
  loading: boolean
  error: string
  pulses: Pulse[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (loading) {
    return <PageState title="正在整理异常情绪" description="稍等一下，我把对应的情绪消息找出来。" />
  }

  if (error) {
    return <PageState variant="error" title="暂时无法查看异常情绪" description={error} />
  }

  if (pulses.length === 0) {
    return <PageState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="family-emotion-message-list">
      {pulses.map((pulse) => (
        <article className="family-emotion-message-card" key={pulse.id}>
          <div className="family-emotion-message-card__head">
            <span className={`status-pill status-pill--${toSeverityTone(pulse.severity)}`}>
              {toSeverityLabel(pulse.severity)}
            </span>
            <span>{formatShortDateTime(pulse.createdAt)}</span>
          </div>
          <strong>{pulse.summary}</strong>
          {pulse.sourceExcerpt ? (
            <p>{pulse.sourceExcerpt}</p>
          ) : (
            <p>
              {toEmotionLabel(pulse.emotionLabel)}，来源于{toEmotionSourceLabel(pulse.emotionSource)}。
            </p>
          )}
          <div className="inline-actions">
            {pulse.sourceConversationId ? (
              <Link
                className="ghost-action ghost-action--link"
                to={`/family/chats/${pulse.sourceConversationId}${pulse.sourceMessageId ? `?messageId=${encodeURIComponent(pulse.sourceMessageId)}` : ''}`}
              >
                查看聊天
              </Link>
            ) : null}
            <Link className="ghost-action ghost-action--link" to={`/family/status?pulseId=${encodeURIComponent(pulse.id)}`}>
              跟进记录
            </Link>
          </div>
        </article>
      ))}
    </div>
  )
}

function filterAbnormalPulsesByDay(pulses: Pulse[], dayKey: string) {
  return pulses
    .filter((pulse) => pulse.pulseType === 'Emotion')
    .filter((pulse) => toDayKey(pulse.createdAt) === dayKey)
    .filter(isAbnormalPulse)
    .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
}

function isAbnormalPulse(pulse: Pulse) {
  if (pulse.severity === 'LOW') return false
  return !['positive', 'calm', 'neutral', 'steady'].includes(`${pulse.emotionLabel ?? ''}`)
}

function toDayKey(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDayTitle(dayKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
  if (!match) return '这一天'
  return `${match[2]}/${match[3]}`
}

function toSeverityTone(severity: string) {
  if (severity === 'HIGH') return 'high'
  if (severity === 'MEDIUM') return 'medium'
  return 'low'
}

function toSeverityLabel(severity: string) {
  if (severity === 'HIGH') return '优先关注'
  if (severity === 'MEDIUM') return '建议关注'
  return '日常留意'
}

function toEmotionLabel(label: string | null | undefined) {
  if (label === 'sad') return '低落'
  if (label === 'anxious') return '焦虑'
  if (label === 'angry') return '烦躁'
  if (label === 'negative') return '消极'
  if (label === 'positive') return '积极'
  if (label === 'calm') return '平静'
  return '情绪异常'
}

function toEmotionSourceLabel(source: string | null | undefined) {
  if (source === 'voice_tone') return '语气识别'
  if (source === 'face') return '表情识别'
  if (source === 'text_fallback') return '文本转写'
  return '文本识别'
}
