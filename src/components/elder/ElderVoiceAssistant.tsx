import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { classifyElderSpeech, type ElderVoiceIntentResult } from '../../domain/elderVoice'
import { createAlert, createMemoryEntry, listConversationCards, listMembers, sendMessage } from '../../services/api'
import type { ConversationCard, Member } from '../../services/api'

const examplePrompts = [
  '我想和女儿说句话',
  '我今天有点不舒服',
  '我想说说话',
  '帮我把这句话记下来',
]

type AssistantStage = 'idle' | 'recording' | 'transcribing' | 'classifying' | 'result' | 'acting'

export function ElderVoiceAssistant() {
  const navigate = useNavigate()
  const location = useLocation()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStartedAtRef = useRef<number | null>(null)

  const [members, setMembers] = useState<Member[]>([])
  const [conversations, setConversations] = useState<ConversationCard[]>([])
  const [stage, setStage] = useState<AssistantStage>('idle')
  const [open, setOpen] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const [result, setResult] = useState<ElderVoiceIntentResult | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [isHolding, setIsHolding] = useState(false)
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null)
  const [recordedDurationSec, setRecordedDurationSec] = useState<number | null>(null)
  const [micSupported, setMicSupported] = useState(true)
  const [sendingVoice, setSendingVoice] = useState(false)

  useEffect(() => {
    void loadDirectory()
    setMicSupported(
      typeof window !== 'undefined' &&
      'MediaRecorder' in window &&
      !!navigator.mediaDevices?.getUserMedia,
    )

    return () => {
      cleanupRecorder()
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    resetAssistant()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <>
      <button
        className={`global-voice-button${isHolding ? ' is-holding' : ''}`}
        type="button"
        aria-label={resolveButtonLabel(stage)}
        onPointerDown={() => void handlePointerDown()}
        onPointerUp={() => void handlePointerUp()}
        onPointerLeave={() => void handlePointerCancel()}
        onPointerCancel={() => void handlePointerCancel()}
        onClick={handleClick}
      >
        <span className="global-voice-button__mic">M</span>
        <span>{resolveButtonLabel(stage)}</span>
      </button>

      {open ? (
        <section className="voice-sheet" aria-live="polite">
          <div className="voice-sheet__header">
            <div>
              <p className="surface-card__eyebrow">语音入口</p>
              <h2>{resolveSheetTitle(stage, result)}</h2>
            </div>
            <button className="ghost-action" type="button" onClick={resetAssistant}>
              关闭
            </button>
          </div>

          {!micSupported ? (
            <p className="state-note state-note--error">
              当前浏览器不支持麦克风录音，请更换浏览器或使用文本输入。
            </p>
          ) : null}

          {stage === 'transcribing' ? (
            <>
              <p className="voice-sheet__hint">
                已停止录音。你可以直接修改这句话，再让 AI 理解你的意图。
              </p>

              {recordedAudioUrl ? (
                <div className="voice-sheet__status-card">
                  <strong>录音已完成</strong>
                  <p>{recordedDurationSec ? `录音时长 ${recordedDurationSec} 秒` : '录音时长未知'}</p>
                  <audio controls src={recordedAudioUrl} preload="none" />
                </div>
              ) : null}

              <textarea
                className="voice-sheet__textarea"
                aria-label="语音转写内容"
                value={spokenText}
                onChange={(event) => setSpokenText(event.target.value)}
                placeholder="例如：我想和女儿说我今天挺好的"
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
                  重新录音
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
              <strong>{stage === 'classifying' ? '我在理解这句话' : '我在执行你的意图'}</strong>
              <p>{spokenText || '请稍等，我正在处理。'}</p>
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
                {result.nextAction === 'open_conversation' ? (
                  <button
                    className="primary-action"
                    type="button"
                    disabled={sendingVoice || !recordedAudioUrl}
                    onClick={() => void sendVoiceToRecognizedTarget(result)}
                  >
                    {sendingVoice ? '发送中' : `发送语音给${result.targetMemberLabel ?? '家人'}`}
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

  async function handlePointerDown() {
    if (!micSupported || stage === 'recording') {
      return
    }

    setOpen(true)
    setFeedback('')
    setError('')
    setResult(null)

    try {
      await startRecording()
      setIsHolding(true)
      setStage('recording')
    } catch (recordError) {
      setStage('transcribing')
      setError(recordError instanceof Error ? recordError.message : '录音启动失败')
    }
  }

  async function handlePointerUp() {
    if (!isHolding) return
    setIsHolding(false)
    await stopRecordingAndOpenTranscribing()
  }

  async function handlePointerCancel() {
    if (!isHolding) return
    setIsHolding(false)
    await stopRecordingAndOpenTranscribing()
  }

  function handleClick() {
    if (stage === 'idle') {
      setOpen(true)
      setStage('transcribing')
    }
  }

  async function startRecording() {
    cleanupRecorder()

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    chunksRef.current = []
    recordingStartedAtRef.current = Date.now()

    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    })

    recorder.start()
  }

  async function stopRecordingAndOpenTranscribing() {
    setStage('transcribing')

    const recorder = recorderRef.current
    if (!recorder) {
      return
    }

    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          if (recordedAudioUrl) {
            URL.revokeObjectURL(recordedAudioUrl)
          }
          if (blob.size > 0) {
            const url = URL.createObjectURL(blob)
            setRecordedAudioUrl(url)
          } else {
            setRecordedAudioUrl(null)
          }

          const started = recordingStartedAtRef.current
          setRecordedDurationSec(started ? Math.max(1, Math.round((Date.now() - started) / 1000)) : null)

          cleanupRecorder()

          if (!spokenText.trim()) {
            setSpokenText('')
          }
          resolve()
        },
        { once: true },
      )

      recorder.stop()
    })
  }

  function cleanupRecorder() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    recorderRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    chunksRef.current = []
    recordingStartedAtRef.current = null
  }

  async function handleInterpret() {
    if (!spokenText.trim()) {
      return
    }

    setStage('classifying')
    setError('')
    setFeedback('')

    await delay(240)
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
        if (recordedAudioUrl) {
          await sendVoiceToRecognizedTarget(nextResult)
        } else {
          setFeedback(`这就带你去找 ${nextResult.targetMemberLabel}`)
          await delay(220)
          navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
            state: {
              elderVoiceResult: nextResult,
              prefillDraft: nextResult.draftText,
            },
          })
        }
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
        setFeedback('已通知家人，请你先安心等待。')
        await delay(220)
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
        setFeedback('已经帮你记下来了。')
        await delay(220)
        navigate('/elder/home', { state: { elderVoiceResult: nextResult } })
        return
      }

      if (nextResult.nextAction === 'open_memories') {
        if (nextResult.targetConversationId) {
          setFeedback(`带你去看 ${nextResult.targetMemberLabel ?? '家人'} 最近发来的内容`)
          await delay(220)
          navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
            state: { elderVoiceResult: nextResult },
          })
          return
        }
        navigate('/elder/inbox', { state: { elderVoiceResult: nextResult } })
        return
      }

      if (nextResult.nextAction === 'stay') {
        setFeedback('我在这儿，你可以继续说。')
        setStage('result')
        return
      }

      setStage('result')
    } catch (actionError) {
      setStage('result')
      setError(actionError instanceof Error ? actionError.message : '执行失败，请再试一次')
    }
  }

  function handleRetry() {
    setStage('transcribing')
    setResult(null)
    setFeedback('')
    setError('')
  }

  async function sendVoiceToRecognizedTarget(nextResult: ElderVoiceIntentResult) {
    if (!nextResult.targetConversationId) {
      setError('暂时没识别到要发给哪位家人，请补充“发给女儿/儿子”等信息。')
      return
    }

    if (!recordedAudioUrl) {
      setError('请先完成录音。')
      return
    }

    try {
      setSendingVoice(true)
      setError('')
      await sendMessage(nextResult.targetConversationId, {
        senderType: 'Elder',
        senderMemberId: 'member_elder',
        messageType: 'Voice',
        textContent: null,
        mediaUrl: recordedAudioUrl,
        voiceDurationSec: recordedDurationSec,
        transcript: spokenText || null,
        transcriptConfidence: spokenText.trim() ? 0.75 : null,
        aiDrafted: false,
        isLowInformation: false,
      })

      setFeedback(`语音已发送给${nextResult.targetMemberLabel ?? '家人'}。`)
      await delay(220)
      navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
        state: {
          elderVoiceResult: nextResult,
        },
      })
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '语音发送失败，请重试')
    } finally {
      setSendingVoice(false)
    }
  }

  function resetAssistant() {
    cleanupRecorder()
    setOpen(false)
    setStage('idle')
    setSpokenText('')
    setResult(null)
    setFeedback('')
    setError('')
    setIsHolding(false)
    setRecordedDurationSec(null)
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl)
    }
    setRecordedAudioUrl(null)
  }
}

function resolveButtonLabel(stage: AssistantStage) {
  if (stage === 'recording') return '正在录音'
  if (stage === 'classifying') return '正在理解'
  if (stage === 'acting') return '正在处理'
  return '按住说话'
}

function resolveSheetTitle(stage: AssistantStage, result: ElderVoiceIntentResult | null) {
  if (stage === 'recording') return '松开后停止录音'
  if (stage === 'transcribing') return '看看这句话对不对'
  if (stage === 'classifying') return '我在判断你的意图'
  if (stage === 'acting') return '我在帮你完成这件事'
  return result?.promptTitle ?? '按住下方按钮开始录音'
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
