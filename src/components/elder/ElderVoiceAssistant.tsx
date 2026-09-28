import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { classifyElderSpeech, type ElderVoiceIntentResult } from '../../domain/elderVoice'
import { createAlert, createMemoryEntry, listConversationCards, listMembers } from '../../services/api'
import type { ConversationCard, Member } from '../../services/api'

const examplePrompts = [
  '我想和女儿说句话',
  '我今天有点不舒服',
  '我就是想说说话',
  '帮我把这句话记下来',
]

type AssistantStage = 'idle' | 'recording' | 'transcribing' | 'classifying' | 'result' | 'acting'

export function ElderVoiceAssistant() {
  const navigate = useNavigate()
  const location = useLocation()
  const [members, setMembers] = useState<Member[]>([])
  const [conversations, setConversations] = useState<ConversationCard[]>([])
  const [stage, setStage] = useState<AssistantStage>('idle')
  const [open, setOpen] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const [result, setResult] = useState<ElderVoiceIntentResult | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [isHolding, setIsHolding] = useState(false)

  useEffect(() => {
    void loadDirectory()
  }, [])

  useEffect(() => {
    setFeedback('')
    setError('')
    setResult(null)
    setOpen(false)
    setStage('idle')
    setSpokenText('')
  }, [location.pathname])

  return (
    <>
      <button
        className={`global-voice-button${isHolding ? ' is-holding' : ''}`}
        type="button"
        aria-label={resolveButtonLabel(stage)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerCancel}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
      >
        <span className="global-voice-button__mic">🎤</span>
        <span>{resolveButtonLabel(stage)}</span>
      </button>

      {open ? (
        <section className="voice-sheet" aria-live="polite">
          <div className="voice-sheet__header">
            <div>
              <p className="surface-card__eyebrow">语音主入口</p>
              <h2>{resolveSheetTitle(stage, result)}</h2>
            </div>
            <button className="ghost-action" type="button" onClick={resetAssistant}>
              关闭
            </button>
          </div>

          {stage === 'transcribing' ? (
            <>
              <p className="voice-sheet__hint">我先把你刚才的话记下来，再帮你理解。</p>
              <textarea
                className="voice-sheet__textarea"
                aria-label="语音识别内容"
                value={spokenText}
                onChange={(event) => setSpokenText(event.target.value)}
                placeholder="比如：我想和大女儿说一声我挺好的"
              />
              <div className="voice-sheet__chips">
                {examplePrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="voice-sheet__chip"
                    type="button"
                    onClick={() => setSpokenText(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="inline-actions">
                <button className="ghost-action" type="button" onClick={resetAssistant}>
                  重新按住
                </button>
                <button
                  className="primary-action"
                  type="button"
                  disabled={!spokenText.trim()}
                  onClick={() => void handleInterpret()}
                >
                  开始理解
                </button>
              </div>
            </>
          ) : null}

          {stage === 'classifying' || stage === 'acting' ? (
            <div className="voice-sheet__status-card">
              <strong>{stage === 'classifying' ? '我正在理解这句话' : '我正在帮你安排后面的事'}</strong>
              <p>{spokenText || '稍等一下，我马上帮你分清楚。'}</p>
            </div>
          ) : null}

          {result ? (
            <article className="voice-sheet__result-card">
              <p className="surface-card__eyebrow">AI 判断</p>
              <strong>{result.promptTitle}</strong>
              <p>{feedback || result.promptBody}</p>

              <div className="voice-sheet__meta">
                <span className="status-pill">置信度 {Math.round(result.confidence * 100)}%</span>
                {result.targetMemberLabel ? <span className="status-pill">对象 {result.targetMemberLabel}</span> : null}
                {result.urgencyLevel !== 'none' ? <span className="status-pill">等级 {toUrgencyLabel(result.urgencyLevel)}</span> : null}
              </div>

              {error ? <p className="state-note state-note--error">{error}</p> : null}

              <div className="inline-actions">
                {showConfirmAction(result, stage) ? (
                  <button className="primary-action" type="button" onClick={() => void executeIntent(result)}>
                    {result.confirmLabel}
                  </button>
                ) : null}
                <button className="ghost-action" type="button" onClick={handleRetry}>
                  再说一次
                </button>
              </div>
            </article>
          ) : null}
        </section>
      ) : null}
    </>
  )

  async function loadDirectory() {
    try {
      const [nextMembers, nextConversations] = await Promise.all([listMembers(), listConversationCards()])
      setMembers(nextMembers)
      setConversations(nextConversations)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '暂时没连上本地服务')
    }
  }

  function handlePointerDown() {
    setIsHolding(true)
    setStage('recording')
    setOpen(true)
    setFeedback('')
    setError('')
  }

  function handlePointerUp() {
    if (!isHolding) return
    setIsHolding(false)
    setStage('transcribing')
    if (!spokenText.trim()) {
      setSpokenText(examplePrompts[Math.floor(Math.random() * examplePrompts.length)] ?? '')
    }
  }

  function handlePointerCancel() {
    if (!isHolding) return
    setIsHolding(false)
    setOpen(true)
    setStage('transcribing')
    if (!spokenText.trim()) {
      setSpokenText(examplePrompts[Math.floor(Math.random() * examplePrompts.length)] ?? '')
    }
  }

  function handleClick() {
    if (stage === 'idle') {
      setOpen(true)
      setStage('transcribing')
    }
  }

  async function handleInterpret() {
    if (!spokenText.trim()) {
      return
    }

    setStage('classifying')
    setError('')
    setFeedback('')

    await delay(420)
    const nextResult = classifyElderSpeech(spokenText, members, conversations)
    setResult(nextResult)
    setStage('result')

    if (!nextResult.requiresConfirmation && nextResult.nextAction !== 'clarify') {
      await executeIntent(nextResult)
    }
  }

  async function executeIntent(nextResult: ElderVoiceIntentResult) {
    try {
      setStage('acting')
      setError('')

      if (nextResult.nextAction === 'open_conversation' && nextResult.targetConversationId) {
        setFeedback(`我这就带你去找${nextResult.targetMemberLabel}。`)
        await delay(280)
        navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
          state: {
            elderVoiceResult: nextResult,
            prefillDraft: nextResult.draftText,
          },
        })
        return
      }

      if (nextResult.nextAction === 'trigger_alert') {
        const alertType = nextResult.urgencyLevel === 'emergency' ? 'SOS' : 'UNWELL'
        await createAlert({
          familySpaceId: 'fs_demo',
          alertType,
          triggerSource: 'Voice',
          escalationLevel: nextResult.urgencyLevel === 'emergency' ? 2 : nextResult.urgencyLevel === 'attention' ? 2 : 1,
        })
        setFeedback(
          nextResult.urgencyLevel === 'emergency'
            ? '已经替你通知家人，现在会优先处理。'
            : '已经通知家人，请他们尽快接住你现在的情况。',
        )
        await delay(280)
        navigate('/elder/help', { state: { elderVoiceResult: nextResult } })
        return
      }

      if (nextResult.nextAction === 'save_memory') {
        await createMemoryEntry({
          familySpaceId: 'fs_demo',
          sourceConvId: nextResult.targetConversationId,
          sourceMsgId: null,
          addedByMemberId: 'member_elder',
          memoryType: 'Text',
          title: '我想记住这句话',
          description: nextResult.draftText || nextResult.spokenText,
          mediaUrl: null,
        })
        setFeedback('已经帮你记下了，家人之后也能在聊天里接着看。')
        await delay(280)
        navigate('/elder/home', { state: { elderVoiceResult: nextResult } })
        return
      }

      if (nextResult.nextAction === 'open_memories') {
        if (nextResult.targetConversationId) {
          setFeedback(`我带你去找${nextResult.targetMemberLabel ?? '家人'}刚刚发来的内容。`)
          await delay(280)
          navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
            state: { elderVoiceResult: nextResult },
          })
          return
        }

        setFeedback('我先带你回到来信里看看最近的内容。')
        await delay(280)
        navigate('/elder/inbox', { state: { elderVoiceResult: nextResult } })
        return
      }

      if (nextResult.nextAction === 'stay') {
        setFeedback('我在。你想继续说，就再按一次下面的话筒。')
        setStage('result')
        return
      }

      setStage('result')
    } catch (actionError) {
      setStage('result')
      setError(actionError instanceof Error ? actionError.message : '这一步暂时没完成，再试一次就好。')
    }
  }

  function handleRetry() {
    setStage('transcribing')
    setResult(null)
    setFeedback('')
    setError('')
  }

  function resetAssistant() {
    setOpen(false)
    setStage('idle')
    setSpokenText('')
    setResult(null)
    setFeedback('')
    setError('')
    setIsHolding(false)
  }
}

function resolveButtonLabel(stage: AssistantStage) {
  if (stage === 'recording') return '正在听'
  if (stage === 'classifying') return '正在理解'
  if (stage === 'acting') return '正在分配'
  return '按住说话'
}

function resolveSheetTitle(stage: AssistantStage, result: ElderVoiceIntentResult | null) {
  if (stage === 'recording') return '松开后，我先替你记下这句话'
  if (stage === 'transcribing') return '看看这句话对不对'
  if (stage === 'classifying') return '我在帮你判断该走哪条路'
  if (stage === 'acting') return '我在帮你把事情接下去'
  return result?.promptTitle ?? '按住下面的话筒，说出你想说的话'
}

function showConfirmAction(result: ElderVoiceIntentResult, stage: AssistantStage) {
  if (stage === 'acting') return false
  if (result.nextAction === 'clarify') return false
  if (result.nextAction === 'stay') return false
  return result.requiresConfirmation
}

function toUrgencyLabel(level: ElderVoiceIntentResult['urgencyLevel']) {
  if (level === 'emergency') return '紧急'
  if (level === 'attention') return '尽快处理'
  if (level === 'normal') return '普通求助'
  return '无'
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
