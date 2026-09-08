import { useEffect, useMemo, useRef, useState } from 'react'
import { createEchoSessions, echoQuickReplyOptions, elderEchoGreeting } from '../data/echoData'
import type { EchoSessionStatus, EchoSessionVM } from '../types'

type EchoEntryPageProps = {
  onBack: () => void
}

export function EchoEntryPage({ onBack }: EchoEntryPageProps) {
  const [sessions, setSessions] = useState<EchoSessionVM[]>(() => createEchoSessions())
  const [feedback, setFeedback] = useState('先看最新回应，再决定要不要继续聊。')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [replyPathBySession, setReplyPathBySession] = useState<Record<string, 'empathy' | 'memory'>>({})
  const [activeSessionId, setActiveSessionId] = useState(() => createEchoSessions()[0]?.id ?? '')
  const [isCompact, setIsCompact] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 960 : false))
  const sessionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth <= 960)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const timerMap = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement
          const sessionId = target.dataset.sessionId
          if (!sessionId) {
            return
          }

          if (entry.intersectionRatio >= 0.75) {
            if (timerMap.has(sessionId)) {
              return
            }

            const timerId = window.setTimeout(() => {
              setSessions((prev) =>
                prev.map((session) => {
                  if (session.id !== sessionId || session.status !== 'new') {
                    return session
                  }
                  return { ...session, status: 'viewed' }
                }),
              )
              timerMap.delete(sessionId)
            }, 3000)
            timerMap.set(sessionId, timerId)
          } else if (timerMap.has(sessionId)) {
            window.clearTimeout(timerMap.get(sessionId))
            timerMap.delete(sessionId)
          }
        })
      },
      { threshold: [0.75] },
    )

    Object.values(sessionRefs.current).forEach((element) => {
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      observer.disconnect()
      timerMap.forEach((timerId) => window.clearTimeout(timerId))
      timerMap.clear()
    }
  }, [sessions.length])

  useEffect(() => {
    if (isCompact) {
      return
    }

    const updateActiveSession = () => {
      const viewportMiddle = window.innerHeight * 0.5
      let candidateId = activeSessionId
      let candidateDistance = Number.POSITIVE_INFINITY

      sessions.forEach((session) => {
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

      if (candidateId) {
        setSessions((prev) =>
          prev.map((session) => {
            if (session.id !== candidateId || !session.snoozed) {
              return session
            }
            return { ...session, snoozed: false }
          }),
        )
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

  const latestSession = sessions.find((session) => session.latest)
  const historySessions = sessions.filter((session) => !session.latest)
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions],
  )

  const onSelectQuickReply = (sessionId: string, reply: string) => {
    setDrafts((prev) => ({ ...prev, [sessionId]: reply }))
  }

  const onSelectReplyPath = (sessionId: string, path: 'empathy' | 'memory') => {
    setReplyPathBySession((prev) => ({ ...prev, [sessionId]: path }))
    const prefill =
      path === 'empathy'
        ? '我听到了，你这样说让我安心很多。'
        : '你提到的那件事我也记得，我们接着说。'
    setDrafts((prev) => ({ ...prev, [sessionId]: prev[sessionId] || prefill }))
    setFeedback(path === 'empathy' ? '已选择路径：先共情再继续聊。' : '已选择路径：先回忆再继续聊。')
  }

  const onDraftChange = (sessionId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [sessionId]: value }))
  }

  const onSubmitReply = (sessionId: string) => {
    const replyText = drafts[sessionId]?.trim()
    if (!replyText) {
      setFeedback('先写一句，再确认回应。')
      return
    }

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) {
          return session
        }
        return { ...session, status: 'replied', canContinue: false }
      }),
    )
    setFeedback(`已回一句：${replyText}`)
  }

  const onFocusInput = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id === sessionId) {
          return { ...session, canContinue: false }
        }
        return session
      }),
    )
  }

  const onContinueTalk = (sessionId: string) => {
    const target = sessions.find((session) => session.id === sessionId)
    setSessions((prev) =>
      prev.map((session) => ({
        ...session,
        canContinue: session.id === sessionId,
        snoozed: session.id === sessionId ? false : session.snoozed,
      })),
    )
    if (target) {
      setFeedback(`已回到这段继续聊：${target.familyName}`)
    }
  }

  const onToggleSnooze = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) {
          return session
        }
        return { ...session, snoozed: !session.snoozed }
      }),
    )
    setFeedback('已更新稍后看状态。')
  }

  return (
    <section style={pageStyle}>
      <style>{ANIMATION_CSS}</style>
      <button className="feature-entry__back" type="button" onClick={onBack} style={{ width: 'fit-content' }}>
        返回首页
      </button>

      <header style={{ display: 'grid', gap: 10, maxWidth: 760 }}>
        <p className="page-shell__eyebrow">回音</p>
        <h2 style={{ margin: 0, color: '#1f2d3d', fontSize: 46, lineHeight: 1.06, letterSpacing: '-0.012em', fontFamily: 'var(--font-display)' }}>
          你昨晚那句“睡不踏实”，今天一早就被认真接住了。
        </h2>
        <p style={{ margin: 0, color: '#4a5b6e', fontSize: 18, lineHeight: 1.6 }}>
          这不是消息列表，是一段从你原话延续出来的回应。
        </p>
        <div style={{ width: 120, height: 1, background: '#b8cbde' }} />
      </header>

      <section style={{ display: 'grid', gap: 4, maxWidth: 760 }}>
        <h3 style={{ margin: 0, color: '#2b3f54', fontSize: 24 }}>{elderEchoGreeting.salutation}</h3>
        <p style={{ margin: 0, color: '#5b6c7d' }}>{elderEchoGreeting.guidance}</p>
      </section>

      <section style={{ display: 'grid', gap: 6, maxWidth: 760 }}>
        <p style={{ margin: 0, color: '#5c7388', fontSize: 13, letterSpacing: '0.03em' }}>今日关系推进线</p>
        <p style={{ margin: 0, color: '#26415a', lineHeight: 1.7 }}>
          先读“当下回应”，再看“历史延续”，最后决定“这一轮要不要继续说下去”。
        </p>
      </section>

      <div style={isCompact ? compactShellStyle : dualRailShellStyle}>
        <div style={{ display: 'grid', gap: 18 }}>
          {latestSession ? (
            <EchoSessionBlock
              session={latestSession}
              isActive={latestSession.id === activeSession?.id}
              isCompact={isCompact}
              isLatest={true}
              draft={drafts[latestSession.id] ?? ''}
              onSelectQuickReply={onSelectQuickReply}
              onSelectReplyPath={onSelectReplyPath}
              replyPath={replyPathBySession[latestSession.id]}
              onDraftChange={onDraftChange}
              onSubmitReply={onSubmitReply}
              onFocusInput={onFocusInput}
              onContinueTalk={onContinueTalk}
              onToggleSnooze={onToggleSnooze}
              registerRef={(element) => {
                sessionRefs.current[latestSession.id] = element
              }}
            />
          ) : null}

          <div style={{ display: 'grid', gap: 0, marginTop: 6 }}>
            {historySessions.map((session) => (
              <EchoSessionBlock
                key={session.id}
                session={session}
                isActive={session.id === activeSession?.id}
                isCompact={isCompact}
                isLatest={false}
                draft={drafts[session.id] ?? ''}
                onSelectQuickReply={onSelectQuickReply}
                onSelectReplyPath={onSelectReplyPath}
                replyPath={replyPathBySession[session.id]}
                onDraftChange={onDraftChange}
                onSubmitReply={onSubmitReply}
                onFocusInput={onFocusInput}
                onContinueTalk={onContinueTalk}
                onToggleSnooze={onToggleSnooze}
                registerRef={(element) => {
                  sessionRefs.current[session.id] = element
                }}
              />
            ))}
          </div>

          <p style={{ margin: 0, color: '#6d7f92' }}>今天的回音先读到这里。你可以随时回来，从其中一句继续说。</p>
        </div>

        {!isCompact ? (
          <aside style={{ position: 'relative' }}>
            {activeSession ? (
              <div style={stickyRailStyle}>
                <RailTrack session={activeSession} />
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      <p style={{ margin: 0, color: '#56687a', fontSize: 14, borderTop: '1px solid #d8e4ef', paddingTop: 10 }}>{feedback}</p>
    </section>
  )
}

type EchoSessionBlockProps = {
  session: EchoSessionVM
  isActive: boolean
  isCompact: boolean
  isLatest: boolean
  draft: string
  onSelectQuickReply: (sessionId: string, reply: string) => void
  onSelectReplyPath: (sessionId: string, path: 'empathy' | 'memory') => void
  replyPath?: 'empathy' | 'memory'
  onDraftChange: (sessionId: string, value: string) => void
  onSubmitReply: (sessionId: string) => void
  onFocusInput: (sessionId: string) => void
  onContinueTalk: (sessionId: string) => void
  onToggleSnooze: (sessionId: string) => void
  registerRef: (element: HTMLElement | null) => void
}

function EchoSessionBlock({
  session,
  isActive,
  isCompact,
  isLatest,
  draft,
  onSelectQuickReply,
  onSelectReplyPath,
  replyPath,
  onDraftChange,
  onSubmitReply,
  onFocusInput,
  onContinueTalk,
  onToggleSnooze,
  registerRef,
}: EchoSessionBlockProps) {
  return (
    <article
      ref={registerRef}
      data-session-id={session.id}
      style={{
        ...sessionStyle(isLatest),
        opacity: session.snoozed ? 0.78 : session.status === 'replied' ? 0.84 : session.status === 'viewed' ? 0.9 : 1,
        boxShadow: isLatest ? (isActive ? '0 18px 40px rgba(23, 56, 87, 0.16)' : '0 10px 26px rgba(23, 56, 87, 0.11)') : 'none',
      }}
    >
      {session.greetingMeta ? <p style={{ margin: 0, color: '#6c8095', fontSize: 13 }}>{session.greetingMeta}</p> : null}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <strong style={{ color: '#1e2d3b', fontSize: isLatest ? 24 : 19 }}>{session.familyName}</strong>
        <span style={{ color: '#6f8398', fontSize: 13 }}>{session.time}</span>
      </div>

      <p style={{ margin: 0, color: '#54708b', fontSize: 13 }}>
        关系线索：{getEchoNarrativeCue(session.status)}
      </p>

      {isLatest ? (
        <p style={{ margin: 0, color: '#223648', lineHeight: 1.78, fontSize: 21, maxWidth: 680 }}>
          <span style={{ float: 'left', fontSize: 44, lineHeight: 0.9, marginRight: 6, fontFamily: 'var(--font-display)', color: '#1d4f7a' }}>
            {session.echoBody.slice(0, 1)}
          </span>
          {session.echoBody.slice(1)}
        </p>
      ) : (
        <p style={{ margin: 0, color: '#223648', lineHeight: 1.75, fontSize: 17 }}>{session.echoBody}</p>
      )}

      {session.voiceTranscription ? (
        <p style={{ margin: 0, color: '#6f8297', fontSize: 14, lineHeight: 1.6 }}>{session.voiceTranscription}</p>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={statusTextStyle(session.status)}>{session.status}</span>
        <button type="button" onClick={() => onContinueTalk(session.id)} style={weakActionStyle}>
          从这里继续聊
        </button>
      </div>

      {session.latest ? (
        session.status === 'replied' ? (
          <p style={{ margin: 0, color: '#2f7860', fontSize: 14 }}>这一轮你已经回应过了，随时可继续补充。</p>
        ) : (
          <section style={inputBlockStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <p style={{ margin: 0, color: '#4a5f75', lineHeight: 1.6 }}>{session.inputHint}</p>
              <button
                type="button"
                style={{ ...micButtonStyle, animation: session.canContinue && isActive ? 'micPulse 3s ease-in-out infinite' : 'none' }}
                aria-label="语音输入占位"
              >
                语音
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {echoQuickReplyOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectQuickReply(session.id, option.label)}
                  style={quickOptionStyle}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onSelectReplyPath(session.id, 'empathy')}
                style={pathOptionStyle(replyPath === 'empathy')}
              >
                路径 A：先共情
              </button>
              <button
                type="button"
                onClick={() => onSelectReplyPath(session.id, 'memory')}
                style={pathOptionStyle(replyPath === 'memory')}
              >
                路径 B：先回忆
              </button>
            </div>

            <textarea
              value={draft}
              onChange={(event) => onDraftChange(session.id, event.target.value)}
              onFocus={() => onFocusInput(session.id)}
              rows={3}
              placeholder="我想回："
              style={inputStyle}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => onSubmitReply(session.id)} style={primaryActionStyle}>
                确认回应
              </button>
              <button type="button" onClick={() => onToggleSnooze(session.id)} style={weakActionStyle}>
                稍后看
              </button>
            </div>
          </section>
        )
      ) : null}

      {isCompact ? <RailTrack session={session} compact /> : null}
    </article>
  )
}

type RailTrackProps = {
  session: EchoSessionVM
  compact?: boolean
}

function RailTrack({ session, compact }: RailTrackProps) {
  return (
    <div style={{ display: 'grid', gap: 10, paddingTop: compact ? 8 : 0 }}>
      <p style={{ margin: 0, fontSize: 12, color: '#6f8398', letterSpacing: '0.04em' }}>{session.context.lead}</p>
      <p style={{ margin: 0, color: '#203445', fontSize: 19, lineHeight: 1.62, fontStyle: 'italic' }}>“{session.context.quote}”</p>
      <p style={{ margin: 0, color: '#75889c', fontSize: 12 }}>{session.context.time}</p>

      {session.memorySnippet ? (
        <div style={{ borderLeft: '2px solid #c9d7e4', paddingLeft: 10, opacity: compact ? 0.95 : 0.9 }}>
          <p style={{ margin: 0, color: '#6f8398', fontSize: 12 }}>{session.memorySnippet.tag}</p>
          <p style={{ margin: 0, color: '#4d6278', lineHeight: 1.55 }}>{session.memorySnippet.text}</p>
        </div>
      ) : null}
    </div>
  )
}

const pageStyle = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: '28px 24px 56px',
  display: 'grid',
  gap: 22,
  background:
    'radial-gradient(circle at 12% 6%, rgba(37,99,235,0.08), transparent 34%), radial-gradient(circle at 88% 12%, rgba(15,118,110,0.08), transparent 30%), linear-gradient(180deg, #fbfdff 0%, #f6faff 60%, #f4f8fc 100%)',
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

const sessionStyle = (isLatest: boolean) => ({
  borderLeft: isLatest ? '4px solid #2563eb' : '1px solid #d4e0eb',
  padding: isLatest ? '18px 20px' : '18px 0 18px 14px',
  borderBottom: isLatest ? 'none' : '1px solid #dfe7ef',
  background: isLatest ? 'linear-gradient(180deg, #ffffff 0%, #f4f9ff 100%)' : 'transparent',
  borderRadius: isLatest ? 14 : 0,
  display: 'grid',
  gap: 12,
  transition: 'opacity 300ms ease, box-shadow 220ms ease, transform 220ms ease',
})

const statusTextStyle = (status: EchoSessionStatus) => ({
  fontSize: 12,
  color: status === 'new' ? '#1d4ed8' : status === 'viewed' ? '#607588' : '#4b7a6a',
  letterSpacing: '0.03em',
})

const stickyRailStyle = {
  position: 'sticky' as const,
  top: 96,
  borderLeft: '1px solid #d5e1eb',
  paddingLeft: 16,
}

const inputBlockStyle = {
  borderTop: '1px solid #d9e4ef',
  paddingTop: 14,
  display: 'grid',
  gap: 10,
  marginTop: 4,
}

const inputStyle = {
  width: '100%',
  border: '1px solid #c7d7e5',
  borderRadius: 8,
  padding: '9px 10px',
  background: '#ffffff',
  color: '#1d2c3a',
  resize: 'vertical' as const,
}

const quickOptionStyle = {
  border: '1px solid #d2e0ee',
  borderRadius: 999,
  background: '#f7fbff',
  color: '#2f4a61',
  padding: '5px 10px',
  cursor: 'pointer',
}

const micButtonStyle = {
  border: '1px solid #bfd5e8',
  borderRadius: 999,
  background: '#edf5fc',
  color: '#295073',
  padding: '4px 10px',
  cursor: 'pointer',
}

const primaryActionStyle = {
  border: '1px solid #2563eb',
  borderRadius: 8,
  background: '#2563eb',
  color: '#fff',
  minHeight: 36,
  padding: '0 14px',
  cursor: 'pointer',
  transition: 'all 180ms ease',
  letterSpacing: '0.01em',
}

const weakActionStyle = {
  border: 'none',
  background: 'transparent',
  color: '#4a647e',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  fontSize: 14,
}

const pathOptionStyle = (active: boolean) => ({
  border: '1px solid #d2e0ee',
  borderRadius: 999,
  background: active ? '#e8f3ff' : '#f7fbff',
  color: active ? '#1d4ed8' : '#2f4a61',
  padding: '5px 10px',
  cursor: 'pointer',
  fontSize: 13,
})

function getEchoNarrativeCue(status: EchoSessionStatus) {
  if (status === 'new') return '这是刚到的回应，优先读完这一段。'
  if (status === 'viewed') return '你已经看过，下一步是决定是否接着聊。'
  return '这一轮已形成闭环，可以作为下一段对话的起点。'
}

const ANIMATION_CSS = `
@keyframes micPulse {
  0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.26); }
  70% { box-shadow: 0 0 0 12px rgba(37,99,235,0); }
  100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
}
`
