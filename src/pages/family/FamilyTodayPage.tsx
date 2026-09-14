import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { careActions } from '../../domain/content/careGuidance'
import { statusItems } from '../../domain/content/statusSignals'
import { createFollowup, listConversationCards, listTodayPulses } from '../../services/api'
import type { ConversationCard, Pulse } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

type TodayPriorityCard = {
  mode: 'followup' | 'chat'
  title: string
  reason: string
  actionLabel: string
  secondaryLabel: string
  secondaryTo: string
  pulse: Pulse | null
  conversationId: string
  summary: string
  tone: 'high' | 'medium' | 'calm'
}

type TodayInsight = {
  source: string
  interpretation: string
  suggestion: string
}

export function FamilyTodayPage() {
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [conversationCards, setConversationCards] = useState<ConversationCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [handlingPulseId, setHandlingPulseId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        const [nextPulses, nextCards] = await Promise.all([
          listTodayPulses(),
          listConversationCards(),
        ])

        if (!cancelled) {
          setPulses(nextPulses)
          setConversationCards(nextCards)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载今天页失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  const pendingCount = useMemo(
    () => pulses.filter((pulse) => pulse.severity !== 'LOW' && pulse.status !== 'RESOLVED').length,
    [pulses],
  )
  const resolvedCount = useMemo(
    () => pulses.filter((pulse) => pulse.status === 'RESOLVED').length,
    [pulses],
  )
  const latestConversation = useMemo(() => conversationCards[0] ?? null, [conversationCards])
  const priorityCard = useMemo(
    () => buildFamilyTodayPriority(pulses, latestConversation),
    [pulses, latestConversation],
  )
  const todayInsight = useMemo(
    () => buildTodayInsight(priorityCard, latestConversation),
    [priorityCard, latestConversation],
  )
  const priorityPulse = priorityCard.pulse

  return (
    <section className="screen screen--family-today">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">今天</p>
            <h2>先抓住今天最值得先回应的一件事。</h2>
          </div>
          <span className="status-pill">待跟进 {pendingCount}</span>
        </div>

        <article className={`today-priority-card today-priority-card--${priorityCard.tone}`}>
          <div className="today-priority-card__copy">
            <p className="surface-card__eyebrow">今天最重要的一件事</p>
            <strong>{priorityCard.title}</strong>
            <p>{priorityCard.reason}</p>
          </div>
          <div className="today-priority-card__actions">
            {priorityCard.mode === 'followup' && priorityPulse ? (
              <button
                className="primary-action"
                type="button"
                disabled={handlingPulseId === priorityPulse.id}
                onClick={() => void handleFollowup(priorityPulse)}
              >
                {handlingPulseId === priorityPulse.id ? '处理中…' : priorityCard.actionLabel}
              </button>
            ) : (
              <Link className="primary-action" to={`/family/chats/${priorityCard.conversationId}`}>
                {priorityCard.actionLabel}
              </Link>
            )}
            <Link className="ghost-action ghost-action--link" to={priorityCard.secondaryTo}>
              {priorityCard.secondaryLabel}
            </Link>
          </div>
        </article>

        <article className="today-insight-strip">
          <div className="today-insight-strip__label">
            <span className="status-pill">AI 判断</span>
            <strong>{todayInsight.interpretation}</strong>
          </div>
          <div className="today-insight-strip__meta">
            <p>原话/摘要：{todayInsight.source}</p>
            <small>{todayInsight.suggestion}</small>
          </div>
        </article>

        <div className="today-overview-strip">
          <div className="today-overview-chip">
            <span>今天动态</span>
            <strong>{pulses.length}</strong>
          </div>
          <div className="today-overview-chip">
            <span>待跟进</span>
            <strong>{pendingCount}</strong>
          </div>
          <div className="today-overview-chip">
            <span>已闭环</span>
            <strong>{resolvedCount}</strong>
          </div>
        </div>

        <section className="pulse-section">
          <div className="section-heading">
            <div>
              <p className="surface-card__eyebrow">今天动态</p>
              <h2>补充看看发生了什么，再决定要不要继续跟进。</h2>
            </div>
            <Link className="ghost-action ghost-action--link" to="/family/status">
              查看全部
            </Link>
          </div>

          <div className="list-stack">
            {loading ? (
              <PageState
                title="正在整理今天最值得先看的内容"
                description="稍等一下，我把今天的状态和沟通线索排在前面。"
              />
            ) : null}
            {error ? (
              <PageState
                variant="error"
                title="今天页暂时没连上本地服务"
                description={error}
              />
            ) : null}
            {!loading && !error && pulses.length === 0 ? (
              <PageState
                title="今天还没有新的状态线索"
                description="可以先发一句问候，或者稍后再回来看看。"
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

        <div className="split-grid">
          {careActions.map((item) => (
            <article className="support-card" key={item.label}>
              <p className="surface-card__eyebrow">{item.label}</p>
              <strong>{item.note}</strong>
            </article>
          ))}
        </div>

        <section className="signal-section">
          <div className="section-heading">
            <div>
              <p className="surface-card__eyebrow">最近线索</p>
              <h2>这些细节可以帮助你判断，为什么现在值得回一句。</h2>
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
            : '已发起一次轻量联系，后续根据反馈继续跟进。',
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

function buildFamilyTodayPriority(
  pulses: Pulse[],
  latestConversation: ConversationCard | null,
): TodayPriorityCard {
  const highPriorityPulse =
    pulses.find((pulse) => pulse.severity === 'HIGH' && pulse.status !== 'RESOLVED') ?? null
  const mediumPriorityPulse =
    pulses.find((pulse) => pulse.severity === 'MEDIUM' && pulse.status !== 'RESOLVED') ?? null

  if (highPriorityPulse) {
    return {
      mode: 'followup',
      title: '今天最该先确认这条提醒。',
      reason: `${highPriorityPulse.summary}，这更像是需要尽快接住的情况。`,
      actionLabel: '我来跟进',
      secondaryLabel: '先看聊天上下文',
      secondaryTo: `/family/chats/${highPriorityPulse.sourceConversationId ?? latestConversation?.id ?? 'daughter'}`,
      pulse: highPriorityPulse,
      conversationId: highPriorityPulse.sourceConversationId ?? latestConversation?.id ?? 'daughter',
      summary: highPriorityPulse.summary,
      tone: 'high',
    }
  }

  if (mediumPriorityPulse) {
    return {
      mode: 'followup',
      title: '这条线索值得今天先回一句。',
      reason: `${mediumPriorityPulse.summary}，建议先用轻一点的方式确认。`,
      actionLabel: '我来跟进',
      secondaryLabel: '先去聊天看看',
      secondaryTo: `/family/chats/${mediumPriorityPulse.sourceConversationId ?? latestConversation?.id ?? 'daughter'}`,
      pulse: mediumPriorityPulse,
      conversationId: mediumPriorityPulse.sourceConversationId ?? latestConversation?.id ?? 'daughter',
      summary: mediumPriorityPulse.summary,
      tone: 'medium',
    }
  }

  if (latestConversation) {
    return {
      mode: 'chat',
      title: '今天适合主动联系一下。',
      reason: latestConversation.primaryMessage?.preview
        ? `最近一条内容是“${latestConversation.primaryMessage.preview}”，现在接上这段话会更自然。`
        : '今天没有明显风险，先发一句短问候就很好。',
      actionLabel: '继续聊天',
      secondaryLabel: '看看全部会话',
      secondaryTo: '/family/chats',
      pulse: null,
      conversationId: latestConversation.id,
      summary: latestConversation.primaryMessage?.preview ?? '今天适合主动问候一下。',
      tone: 'calm',
    }
  }

  return {
    mode: 'chat',
    title: '今天先发一句问候就够了。',
    reason: '目前没有新的高优先级提醒，先把联系接起来最重要。',
    actionLabel: '去聊天页',
    secondaryLabel: '看看协作页',
    secondaryTo: '/family/collaboration',
    pulse: null,
    conversationId: 'daughter',
    summary: '目前没有新的高优先级提醒。',
    tone: 'calm',
  }
}

function buildTodayInsight(
  priorityCard: TodayPriorityCard,
  latestConversation: ConversationCard | null,
): TodayInsight {
  if (priorityCard.pulse) {
    return {
      source: priorityCard.summary,
      interpretation:
        priorityCard.pulse.severity === 'HIGH'
          ? '这更像是在表达不适或需要立刻被确认。'
          : '这更像是在释放一个值得接住的信号，不一定紧急，但不适合拖太久。',
      suggestion:
        priorityCard.pulse.severity === 'HIGH'
          ? '建议先电话确认，再决定是否继续升级处理。'
          : '建议先回一句轻量问候，让对方知道你已经看到。',
    }
  }

  if (latestConversation?.primaryMessage?.preview) {
    return {
      source: latestConversation.primaryMessage.preview,
      interpretation: '这更像是一句想继续说下去的话，现在接住会更自然。',
      suggestion: '建议用一条短语音回应，不必一开始就问太多。',
    }
  }

  return {
    source: '今天还没有新的重点表达。',
    interpretation: '目前没有明显风险，更适合主动发起一次轻量联系。',
    suggestion: '建议晚些时候发一句问候，让沟通先开始。',
  }
}

function toSeverityTone(severity: string) {
  if (severity === 'HIGH') return 'high'
  if (severity === 'MEDIUM') return 'medium'
  return 'low'
}
