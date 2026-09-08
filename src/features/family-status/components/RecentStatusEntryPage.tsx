import { useEffect, useMemo, useRef, useState } from 'react'
import { createDecisionSessions } from '../data/statusData'
import type { DecisionSessionVM, EvidenceBlock, RecentProcessState } from '../types'

type RecentStatusEntryPageProps = {
  onBack: () => void
}

export function RecentStatusEntryPage({ onBack }: RecentStatusEntryPageProps) {
  const [sessions, setSessions] = useState<DecisionSessionVM[]>(() => createDecisionSessions())
  const [feedback, setFeedback] = useState('先执行首屏动作，再看后续关注。')
  const [actionPathBySession, setActionPathBySession] = useState<Record<string, 'stabilize' | 'probe'>>({})
  const [activeSessionId, setActiveSessionId] = useState(() => createDecisionSessions()[0]?.id ?? '')
  const [collapsedPriority, setCollapsedPriority] = useState(false)
  const [isCompact, setIsCompact] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 960 : false))
  const sessionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth <= 960)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const prioritySession = sessions.find((session) => session.tier === 'priority')
    if (!prioritySession) {
      return
    }

    const shouldCollapse = prioritySession.processState === 'done'
    const timer = window.setTimeout(() => setCollapsedPriority(shouldCollapse), shouldCollapse ? 500 : 0)
    return () => window.clearTimeout(timer)
  }, [sessions])

  useEffect(() => {
    if (isCompact) {
      return
    }

    const updateActiveSession = () => {
      const viewportMiddle = window.innerHeight * 0.5
      let candidateId = activeSessionId
      let candidateDistance = Number.POSITIVE_INFINITY

      sessions.forEach((session) => {
        if (session.tier === 'reminder') {
          return
        }

        const element = sessionRefs.current[session.id]
        if (!element) {
          return
        }

        const rect = element.getBoundingClientRect()
        const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
        const ratio = Math.max(0, visibleHeight) / Math.max(rect.height, 1)
        if (ratio < 0.5) {
          return
        }

        const center = rect.top + rect.height / 2
        const distance = Math.abs(center - viewportMiddle)
        if (distance < candidateDistance) {
          candidateDistance = distance
          candidateId = session.id
        }
      })

      if (candidateId && candidateId !== activeSessionId) {
        setActiveSessionId(candidateId)
      }
    }

    updateActiveSession()
    window.addEventListener('scroll', updateActiveSession, { passive: true })
    window.addEventListener('resize', updateActiveSession)

    return () => {
      window.removeEventListener('scroll', updateActiveSession)
      window.removeEventListener('resize', updateActiveSession)
    }
  }, [activeSessionId, isCompact, sessions])

  const prioritySessions = sessions.filter((session) => session.tier === 'priority')
  const attentionSessions = sessions.filter((session) => session.tier === 'attention')
  const reminderSessions = sessions.filter((session) => session.tier === 'reminder')

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  )

  const onPrimaryAction = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) {
          return session
        }

        if (session.processState === 'todo') {
          setFeedback(`已执行：${session.actionLabel}`)
          return { ...session, processState: session.actionType === 'visit' ? 'done' : 'doing' }
        }

        if (session.processState === 'doing') {
          setFeedback(`处理中确认完成：${session.contactName}`)
          return { ...session, processState: 'done' }
        }

        setFeedback('该事项已完成。')
        return session
      }),
    )
  }

  const onMarkDone = (sessionId: string) => {
    setSessions((prev) => prev.map((session) => (session.id === sessionId ? { ...session, processState: 'done' } : session)))
    setFeedback('已标记完成。')
  }

  const onSelectActionPath = (sessionId: string, path: 'stabilize' | 'probe') => {
    setActionPathBySession((prev) => ({ ...prev, [sessionId]: path }))
    setFeedback(path === 'stabilize' ? '已选择路径：先稳定情绪再推进。' : '已选择路径：先探因再决定节奏。')
  }

  return (
    <section style={pageStyle}>
      <style>{ANIMATION_CSS}</style>
      <button className="feature-entry__back" type="button" onClick={onBack} style={{ width: 'fit-content' }}>
        返回首页
      </button>

      <header style={{ display: 'grid', gap: 10, maxWidth: 760 }}>
        <p className="page-shell__eyebrow">最近状态</p>
        <h2 style={{ margin: 0, color: '#243445', fontSize: 46, lineHeight: 1.06, letterSpacing: '-0.012em', fontFamily: 'var(--font-display)' }}>
          今天最值得先做的一件事，是先稳住她的情绪。
        </h2>
        <p style={{ margin: 0, color: '#4a5d70', fontSize: 18, lineHeight: 1.6 }}>
          先执行主动作，再处理关注流，最后看长期备忘。
        </p>
        <div style={{ width: 120, height: 1, background: '#c3d5e7' }} />
      </header>

      <section style={{ display: 'grid', gap: 6, maxWidth: 760 }}>
        <p style={{ margin: 0, color: '#5c7388', fontSize: 13, letterSpacing: '0.03em' }}>今日决策剧本</p>
        <p style={{ margin: 0, color: '#26415a', lineHeight: 1.7 }}>
          先回答“为什么是现在”，再执行“最先动作”，最后确认“做完后会有什么变化”。
        </p>
      </section>

      <div style={isCompact ? compactShellStyle : dualRailShellStyle}>
        <div style={{ display: 'grid', gap: 20 }}>
          <section style={{ display: 'grid', gap: 12 }}>
            {collapsedPriority ? (
              <article style={collapsedPriorityStyle}>
                <strong style={{ color: '#2f6f5b' }}>最高优动作已完成</strong>
                <p style={{ margin: 0, color: '#4f7467' }}>你已经处理完今天最关键的事项。</p>
                <button type="button" style={weakActionStyle} onClick={() => setCollapsedPriority(false)}>
                  展开查看
                </button>
              </article>
            ) : (
              prioritySessions.map((session) => (
                <DecisionSessionBlock
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSession?.id}
                  isCompact={isCompact}
                  showRailInline={isCompact}
                  visualMode="priority"
                  actionPath={actionPathBySession[session.id]}
                  onSelectActionPath={onSelectActionPath}
                  onPrimaryAction={onPrimaryAction}
                  onMarkDone={onMarkDone}
                  registerRef={(element) => {
                    sessionRefs.current[session.id] = element
                  }}
                />
              ))
            )}
          </section>

          <section style={{ display: 'grid', gap: 0 }}>
            {attentionSessions.map((session) => (
              <DecisionSessionBlock
                key={session.id}
                session={session}
                isActive={session.id === activeSession?.id}
                isCompact={isCompact}
                showRailInline={isCompact}
                visualMode="attention"
                actionPath={actionPathBySession[session.id]}
                onSelectActionPath={onSelectActionPath}
                onPrimaryAction={onPrimaryAction}
                onMarkDone={onMarkDone}
                registerRef={(element) => {
                  sessionRefs.current[session.id] = element
                }}
              />
            ))}
          </section>

          <section style={{ display: 'grid', gap: 0 }}>
            {reminderSessions.map((session) => (
              <DecisionSessionBlock
                key={session.id}
                session={session}
                isActive={false}
                isCompact={true}
                showRailInline={false}
                visualMode="reminder"
                actionPath={actionPathBySession[session.id]}
                onSelectActionPath={onSelectActionPath}
                onPrimaryAction={onPrimaryAction}
                onMarkDone={onMarkDone}
                registerRef={(element) => {
                  sessionRefs.current[session.id] = element
                }}
              />
            ))}
          </section>
        </div>

        {!isCompact ? (
          <aside style={{ position: 'relative' }}>
            <div style={stickyRailStyle}>
              {activeSession && activeSession.tier !== 'reminder' ? (
                <EvidenceCluster evidence={activeSession.evidence} animateKey={activeSession.id} />
              ) : (
                <p style={{ margin: 0, color: '#6a7d90' }}>长期备忘默认不展示完整证据轨。</p>
              )}
            </div>
          </aside>
        ) : null}
      </div>

      <p style={{ margin: 0, color: '#586c80', fontSize: 14, borderTop: '1px solid #d8e4ef', paddingTop: 10 }}>{feedback}</p>
    </section>
  )
}

type DecisionSessionBlockProps = {
  session: DecisionSessionVM
  isActive: boolean
  isCompact: boolean
  showRailInline: boolean
  visualMode: 'priority' | 'attention' | 'reminder'
  actionPath?: 'stabilize' | 'probe'
  onSelectActionPath: (sessionId: string, path: 'stabilize' | 'probe') => void
  onPrimaryAction: (sessionId: string) => void
  onMarkDone: (sessionId: string) => void
  registerRef: (element: HTMLElement | null) => void
}

function DecisionSessionBlock({
  session,
  isActive,
  isCompact,
  showRailInline,
  visualMode,
  actionPath,
  onSelectActionPath,
  onPrimaryAction,
  onMarkDone,
  registerRef,
}: DecisionSessionBlockProps) {
  const processLabel = getProcessLabel(session.processState)
  const evidenceForTier = session.tier === 'priority' ? session.evidence.slice(0, 3) : session.evidence.slice(0, 2)

  return (
    <article
      ref={registerRef}
      data-session-id={session.id}
      style={{
        ...decisionStyle(visualMode),
        opacity: session.processState === 'done' ? 0.84 : visualMode === 'reminder' ? 0.72 : 1,
        borderLeftColor: getTierAccent(session.tier),
        boxShadow: visualMode === 'priority' ? (isActive ? '0 18px 38px rgba(35,72,108,0.16)' : '0 10px 24px rgba(35,72,108,0.11)') : 'none',
      }}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#6a7e92', fontSize: 13 }}>{session.time}</span>
          <span style={tierPillStyle(session.tier)}>{session.tier}</span>
        </div>

        <section style={{ display: 'grid', gap: 6 }}>
          <p style={{ margin: 0, color: '#6f8297', fontSize: 13 }}>{session.insightTag}</p>
          <h3
            style={{
              margin: 0,
              color: '#1f3143',
              fontSize: visualMode === 'priority' ? 33 : 22,
              lineHeight: 1.2,
              fontFamily: visualMode === 'priority' ? 'var(--font-display)' : 'var(--font-sans)',
            }}
          >
            {session.insightText}
          </h3>
        </section>

        <p style={{ margin: 0, color: '#54708b', fontSize: 13 }}>
          预期变化：{getOutcomePreview(session.processState)}
        </p>

        <section style={actionBlockStyle(visualMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ color: '#2a3f52' }}>{session.contactName}</strong>
            <span style={{ color: '#60768b', fontSize: 13 }}>状态：{processLabel}</span>
          </div>

          <button type="button" onClick={() => onPrimaryAction(session.id)} style={primaryActionStyle(session.processState, visualMode)}>
            {session.processState === 'done' ? session.actionDoneText : session.actionLabel}
          </button>

          {visualMode !== 'reminder' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => onSelectActionPath(session.id, 'stabilize')} style={pathOptionStyle(actionPath === 'stabilize')}>
                路径 A：先稳情绪
              </button>
              <button type="button" onClick={() => onSelectActionPath(session.id, 'probe')} style={pathOptionStyle(actionPath === 'probe')}>
                路径 B：先探原因
              </button>
            </div>
          ) : null}

          <button type="button" onClick={() => onMarkDone(session.id)} style={weakActionStyle}>
            标记 done
          </button>
        </section>

        {session.secondaryPrompt ? <p style={{ margin: 0, color: '#546a80', lineHeight: 1.6 }}>{session.secondaryPrompt}</p> : null}
      </div>

      {showRailInline ? <EvidenceCluster evidence={evidenceForTier} animateKey={session.id} compact={isCompact} /> : null}
    </article>
  )
}

type EvidenceClusterProps = {
  evidence: EvidenceBlock[]
  animateKey: string
  compact?: boolean
}

function EvidenceCluster({ evidence, animateKey, compact }: EvidenceClusterProps) {
  return (
    <div key={animateKey} style={{ display: 'grid', gap: 8, animation: 'fadeShift 300ms ease' }}>
      {evidence.slice(0, 3).map((item) => (
        <article key={item.id} style={evidenceStyle(item.type, compact)}>
          <p style={{ margin: 0, color: '#6f8297', fontSize: 12 }}>{item.title}</p>
          <p style={{ margin: 0, color: '#294057', lineHeight: 1.5 }}>{item.content}</p>
        </article>
      ))}
    </div>
  )
}

function getProcessLabel(processState: RecentProcessState) {
  if (processState === 'todo') return 'todo'
  if (processState === 'doing') return 'doing'
  return 'done'
}

function getTierAccent(tier: DecisionSessionVM['tier']) {
  if (tier === 'priority') return '#1d4ed8'
  if (tier === 'attention') return '#0f766e'
  return '#8a98a8'
}

const pageStyle = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: '28px 24px 56px',
  display: 'grid',
  gap: 22,
  background:
    'radial-gradient(circle at 10% 5%, rgba(14,165,233,0.08), transparent 35%), radial-gradient(circle at 92% 16%, rgba(37,99,235,0.08), transparent 34%), linear-gradient(180deg, #fbfdff 0%, #f5f9ff 58%, #f2f7fc 100%)',
}

const dualRailShellStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 66%) minmax(260px, 34%)',
  gap: 30,
  alignItems: 'start',
}

const compactShellStyle = {
  display: 'grid',
  gap: 16,
}

const decisionStyle = (mode: DecisionSessionBlockProps['visualMode']) => {
  if (mode === 'priority') {
    return {
      borderLeft: '4px solid #1d4ed8',
      padding: '18px 20px',
      borderRadius: 14,
      background: 'linear-gradient(180deg, #ffffff 0%, #f2f8ff 100%)',
      display: 'grid',
      gap: 12,
      transition: 'all 250ms ease',
    }
  }

  if (mode === 'attention') {
    return {
      borderLeft: '2px solid #cde1ef',
      borderBottom: '1px solid #dce8f1',
      padding: '18px 0 16px 14px',
      background: 'transparent',
      display: 'grid',
      gap: 10,
      transition: 'all 250ms ease',
    }
  }

  return {
    borderLeft: '1px solid #d8e2ea',
    borderBottom: '1px dashed #d8e2ea',
    padding: '14px 0 14px 12px',
    background: 'transparent',
    display: 'grid',
    gap: 8,
    transition: 'all 250ms ease',
  }
}

const actionBlockStyle = (mode: DecisionSessionBlockProps['visualMode']) => ({
  display: 'grid',
  gap: 8,
  padding: mode === 'priority' ? '10px 0 0' : 0,
})

const stickyRailStyle = {
  position: 'sticky' as const,
  top: 96,
  borderLeft: '1px solid #d5e1eb',
  paddingLeft: 16,
}

const collapsedPriorityStyle = {
  borderLeft: '3px solid #2f7d65',
  padding: '12px 0 12px 12px',
  background: 'linear-gradient(180deg, #effaf4 0%, #f8fffb 100%)',
  borderRadius: 8,
  display: 'grid',
  gap: 6,
}

const weakActionStyle = {
  border: 'none',
  background: 'transparent',
  color: '#4b647d',
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  width: 'fit-content',
  fontSize: 14,
}

const pathOptionStyle = (active: boolean) => ({
  border: '1px solid #c8ddf1',
  borderRadius: 999,
  background: active ? '#e8f3ff' : '#f5f9fe',
  color: active ? '#1d4ed8' : '#39566f',
  cursor: 'pointer',
  padding: '4px 10px',
  fontSize: 13,
})

function primaryActionStyle(processState: RecentProcessState, mode: DecisionSessionBlockProps['visualMode']) {
  const compact = mode !== 'priority'
  const minHeight = compact ? 34 : 38
  const padding = compact ? '0 10px' : '0 12px'

  if (processState === 'done') {
    return {
      border: '1px solid #2f7d65',
      background: '#2f7d65',
      color: '#fff',
      borderRadius: 8,
      minHeight,
      padding,
      cursor: 'pointer',
      width: 'fit-content',
      transition: 'all 180ms ease',
    }
  }

  if (processState === 'doing') {
    return {
      border: '1px solid #0f766e',
      background: '#0f766e',
      color: '#fff',
      borderRadius: 8,
      minHeight,
      padding,
      cursor: 'pointer',
      width: 'fit-content',
      transition: 'all 180ms ease',
    }
  }

  return {
    border: '1px solid #1d4ed8',
    background: '#1d4ed8',
    color: '#fff',
    borderRadius: 8,
    minHeight,
    padding,
    cursor: 'pointer',
    width: 'fit-content',
    transition: 'all 180ms ease',
  }
}

function tierPillStyle(tier: DecisionSessionVM['tier']) {
  if (tier === 'priority') {
    return { borderRadius: 999, padding: '3px 10px', background: '#dbeafe', color: '#1d4ed8', fontSize: 12 }
  }
  if (tier === 'attention') {
    return { borderRadius: 999, padding: '3px 10px', background: '#ccfbf1', color: '#0f766e', fontSize: 12 }
  }
  return { borderRadius: 999, padding: '3px 10px', background: '#e2e8f0', color: '#64748b', fontSize: 12 }
}

function evidenceStyle(type: EvidenceBlock['type'], compact?: boolean) {
  if (type === 'photo') {
    return {
      border: 'none',
      borderRadius: 6,
      background: 'linear-gradient(145deg, #f0f7ff 0%, #dbeafe 100%)',
      aspectRatio: '1 / 1',
      padding: compact ? '9px 10px' : '10px 11px',
      display: 'grid',
      alignContent: 'center',
      gap: 6,
    }
  }

  if (type === 'quote') {
    return {
      borderLeft: '2px solid #bfdbfe',
      padding: compact ? '8px 10px' : '10px 11px',
      background: 'transparent',
      display: 'grid',
      gap: 6,
    }
  }

  return {
    padding: compact ? '8px 10px' : '10px 11px',
    background: '#f1f5f9',
    borderRadius: 6,
    display: 'grid',
    gap: 6,
  }
}

const ANIMATION_CSS = `
@keyframes fadeShift {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`

function getOutcomePreview(processState: RecentProcessState) {
  if (processState === 'todo') return '现在执行，通常能更快稳定情绪波动。'
  if (processState === 'doing') return '这一步正在生效，建议保持同频跟进。'
  return '这一项已收束，可以把注意力转移到下一条。'
}
