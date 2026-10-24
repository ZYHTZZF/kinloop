import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { classifyElderSpeech, type ElderVoiceIntentResult } from '../../domain/elderVoice'
import {
  createAlert,
  createMemoryEntry,
  getCurrentFamilySpace,
  inferElderIntent,
  listConversationCards,
  listMembers,
  sendMessage,
  synthesizeSpeech,
} from '../../services/api'
import type { ConversationCard, Member } from '../../services/api'
import {
  isLocalWakeWordAvailable,
  speakNativeWakeReply,
  startLocalWakeWordListening,
  type LocalWakeWordSession,
} from '../../platform/localWakeWord'
import { ensureMicrophoneCapturePermission, ensureSpeechRecognitionPermission } from '../../platform/permissions'
import {
  getSpeechRecognitionSupportStatus,
  isSpeechRecognitionSupported,
  startRecordedSpeechRecognition,
  startSpeechRecognition,
  type SpeechSession,
} from '../../platform/speech'

const examplePrompts = [
  '我想和女儿说句话',
  '我今天有点不舒服',
  '我就是想说说话',
  '帮我把这句话记下来',
]

type AssistantStage = 'idle' | 'recording' | 'transcribing' | 'classifying' | 'result' | 'acting'
const AUTO_EXECUTE_CONFIDENCE = 0.78
const WAKE_WORD = '小智小智'
const SECONDARY_WAKE_WORD = '小智同学'
const WAKE_WORD_ALIASES = [
  '小智小智',
  '小智同学',
  '小智',
  '小知同学',
  '小知小知',
  '小知',
  '小志同学',
  '小志小志',
  '小志',
  '晓智同学',
  '晓智晓智',
  '晓智',
  '小智小志',
  '小志小智',
]
const WAKE_WORD_KEYWORD_SPEC = [
  'x iǎo zh ì x iǎo zh ì @小智小智',
  'x iǎo zh ì t óng x ué @小智同学',
  'x iǎo zh ì @小智',
  'x iǎo zh ī t óng x ué @小知同学',
  'x iǎo zh ī x iǎo zh ī @小知小知',
  'x iǎo zh ī @小知',
  'x iǎo zh ì t óng x ué @小志同学',
  'x iǎo zh ì x iǎo zh ì @小志小志',
  'x iǎo zh ì @小志',
  'x iǎo zh ì t óng x ué @晓智同学',
  'x iǎo zh ì x iǎo zh ì @晓智晓智',
  'x iǎo zh ì @晓智',
  'x iǎo zh ì x iǎo zh ì @小智小志',
  'x iǎo zh ì x iǎo zh ì @小志小智',
].join('\n')

export function ElderVoiceAssistant() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHomeRoute = location.pathname === '/elder/home'
  const isConversationRoute = /^\/elder\/conversations\/[^/]+$/.test(location.pathname)
  const [members, setMembers] = useState<Member[]>([])
  const [conversations, setConversations] = useState<ConversationCard[]>([])
  const [familySpaceId, setFamilySpaceId] = useState('fs_demo')
  const [elderMemberId, setElderMemberId] = useState('member_elder')
  const [aiConversationId, setAiConversationId] = useState<string | null>(null)
  const [stage, setStage] = useState<AssistantStage>('idle')
  const [open, setOpen] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const [result, setResult] = useState<ElderVoiceIntentResult | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [assistantNotice, setAssistantNotice] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [edgePosition, setEdgePosition] = useState<{ x: number; y: number } | null>(null)
  const [wakeWordDebug, setWakeWordDebug] = useState('')

  const micReadyRef = useRef(false)
  const speechSessionRef = useRef<SpeechSession | null>(null)
  const wakeWordSessionRef = useRef<SpeechSession | LocalWakeWordSession | null>(null)
  const wakeWordRestartTimerRef = useRef<number | null>(null)
  const wakeWordEnabledRef = useRef(false)
  const wakeWordTriggeredRef = useRef(false)
  const recordingFinishingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioObjectUrlRef = useRef<string | null>(null)
  const spokenTextRef = useRef('')
  const edgeButtonRef = useRef<HTMLButtonElement | null>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const suppressTapRef = useRef(false)
  const wakeWordEnabled = location.pathname.startsWith('/elder') && !open && stage === 'idle' && !isRecording

  useEffect(() => {
    wakeWordEnabledRef.current = wakeWordEnabled
  }, [wakeWordEnabled])

  useEffect(() => {
    void loadDirectory()
  }, [])

  useEffect(() => {
    resetAssistant()
  }, [location.pathname])

  useEffect(() => {
    if (!isConversationRoute || typeof window === 'undefined') return
    setEdgePosition(getDefaultEdgePosition())
  }, [isConversationRoute])

  useEffect(() => {
    function handleWindowResize() {
      setEdgePosition((current) => {
        if (!current) return getDefaultEdgePosition()
        return clampEdgePosition(current.x, current.y)
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleWindowResize)
      return () => window.removeEventListener('resize', handleWindowResize)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.addEventListener('pointermove', handleEdgePointerMove)
    window.addEventListener('pointerup', handleEdgePointerUp)
    window.addEventListener('pointercancel', handleEdgePointerUp)

    return () => {
      window.removeEventListener('pointermove', handleEdgePointerMove)
      window.removeEventListener('pointerup', handleEdgePointerUp)
      window.removeEventListener('pointercancel', handleEdgePointerUp)
    }
  }, [])

  useEffect(() => {
    if (!wakeWordEnabled) {
      void stopWakeWordListening()
      return
    }

    void startWakeWordListening()

    return () => {
      void stopWakeWordListening()
    }
  }, [wakeWordEnabled])

  return (
    <>
      {!open && wakeWordDebug ? (
        <div
          style={{
            position: 'fixed',
            right: isConversationRoute ? 20 : 16,
            bottom: isConversationRoute ? 108 : 24,
            zIndex: 60,
            maxWidth: 260,
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(15, 23, 42, 0.82)',
            color: '#fff',
            fontSize: 12,
            lineHeight: 1.4,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
          }}
        >
          {wakeWordDebug}
        </div>
      ) : null}
      {open ? (
        <section className={['voice-sheet', isConversationRoute ? 'voice-sheet--edge' : ''].filter(Boolean).join(' ')} aria-live="polite">
          <div className="voice-sheet__header">
            <div>
              <p className="surface-card__eyebrow">语音入口</p>
              <h2>{resolveSheetTitle(stage, result)}</h2>
            </div>
            <button className="ghost-action" type="button" onClick={resetAssistant}>
              关闭
            </button>
          </div>

          {error ? <p className="state-note state-note--error">{error}</p> : null}
          {assistantNotice ? <p className="state-note">{assistantNotice}</p> : null}

          {stage === 'recording' ? (
            <div className="voice-sheet__status-card">
              <strong>麦克风正在工作</strong>
              <p>说完我会自动继续，你也可以点“结束说话”提前提交。</p>
              {spokenText ? <p>{spokenText}</p> : null}
              <div className="inline-actions">
                <button className="primary-action" type="button" onClick={() => void finishWakeRecording()}>
                  结束说话
                </button>
                <button className="ghost-action" type="button" onClick={resetAssistant}>
                  取消
                </button>
              </div>
            </div>
          ) : null}

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
              <strong>{stage === 'classifying' ? '我正在理解这句话' : '我正在帮你安排后面的事'}</strong>
              <p>{spokenText || '请稍等，我马上帮你判断。'}</p>
            </div>
          ) : null}

          {result ? (
            <article className="voice-sheet__result-card">
              <p className="surface-card__eyebrow">AI 判断</p>
              <strong>{result.promptTitle}</strong>
              <p>{feedback || result.assistantReply || result.promptBody}</p>

              <div className="voice-sheet__meta">
                <span className="status-pill">置信度 {Math.round(result.confidence * 100)}%</span>
                {result.targetMemberLabel ? <span className="status-pill">对象 {result.targetMemberLabel}</span> : null}
                {result.urgencyLevel !== 'none' ? <span className="status-pill">等级 {toUrgencyLabel(result.urgencyLevel)}</span> : null}
              </div>

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

  function handleEdgeButtonClick() {
    if (suppressTapRef.current) {
      suppressTapRef.current = false
      return
    }

    void handleVoiceToggle()
  }

  function handleEdgePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (typeof window === 'undefined') return

    const buttonRect = event.currentTarget.getBoundingClientRect()
    const nextOrigin = edgePosition ?? { x: buttonRect.left, y: buttonRect.top }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: nextOrigin.x,
      originY: nextOrigin.y,
      moved: false,
    }

    suppressTapRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleEdgePointerMove(event: PointerEvent) {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragState.startX
    const deltaY = event.clientY - dragState.startY
    const movedEnough = Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4

    if (movedEnough) {
      dragState.moved = true
      suppressTapRef.current = true
    }

    if (!dragState.moved) return

    setEdgePosition(clampEdgePosition(dragState.originX + deltaX, dragState.originY + deltaY))
  }

  function handleEdgePointerUp(event: PointerEvent) {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return

    if (dragState.moved) {
      const buttonRect = edgeButtonRef.current?.getBoundingClientRect()
      if (buttonRect) {
        setEdgePosition(clampEdgePosition(buttonRect.left, buttonRect.top))
      }
    }

    dragStateRef.current = null
  }

  async function loadDirectory() {
    try {
      const [nextMembers, nextConversations, familySpace] = await Promise.all([
        listMembers(),
        listConversationCards(),
        getCurrentFamilySpace(),
      ])
      setMembers(nextMembers)
      setConversations(nextConversations)
      setFamilySpaceId(familySpace.id)
      setElderMemberId(nextMembers.find((member) => member.role === 'Elder')?.id ?? 'member_elder')
      setAiConversationId(nextConversations.find((conversation) => conversation.conversationType === 'AI_ASSISTANT')?.id ?? null)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '暂时无法准备语音助手，请稍后再试。')
    }
  }

  async function handleVoiceToggle() {
    if (stage === 'classifying' || stage === 'acting') return

    await stopWakeWordListening()
    await delay(180)

    if (isRecording) {
      setStage('transcribing')
      await stopRecording(true)
      setIsRecording(false)
      return
    }

    const micReady = await ensureMicrophoneReady()
    if (!micReady) {
      setOpen(true)
      setStage('transcribing')
      return
    }

    const started = await startRecording()
    if (!started) {
      setOpen(true)
      setStage('transcribing')
      return
    }

    setOpen(true)
    setStage('recording')
    setFeedback('')
    setError('')
    setResult(null)
    setSpokenText('')
    spokenTextRef.current = ''
    setAssistantNotice('')
    setIsRecording(true)
  }

  async function finishWakeRecording() {
    if (!isRecording) return

    setStage('transcribing')
    await stopRecording(true)
    setIsRecording(false)
  }

  async function handleInterpret(inputText = spokenText) {
    const normalizedInput = inputText.trim()
    if (!normalizedInput) return

    setStage('classifying')
    setError('')
    setFeedback('')
    setAssistantNotice('')
    if (normalizedInput !== spokenText) {
      setSpokenText(normalizedInput)
      spokenTextRef.current = normalizedInput
    }
    await appendAiLog(normalizedInput, 'Elder', elderMemberId)

    await delay(420)
    const nextResult = await resolveIntent(normalizedInput)
    setResult(nextResult)
    setStage('result')

    if (nextResult.nextAction === 'clarify') {
      const clarifyReply = nextResult.assistantReply || nextResult.promptBody || nextResult.promptTitle
      speak(clarifyReply)
      await appendAiLog(clarifyReply, 'System', null)
      return
    }

    if (nextResult.nextAction === 'stay') {
      const stayReply = nextResult.assistantReply || nextResult.promptBody || nextResult.promptTitle
      speak(stayReply)
      await appendAiLog(stayReply, 'System', null)
      return
    }

    if (shouldAutoExecute(nextResult)) {
      speak(nextResult.assistantReply || nextResult.promptTitle || 'I got it. I will handle this now.')
      await executeIntent(nextResult)
    }
  }

  async function executeIntent(nextResult: ElderVoiceIntentResult) {
    try {
      setStage('acting')
      setError('')
      if (nextResult.nextAction === 'open_conversation' && nextResult.targetConversationId) {
        setFeedback(`我这就带你去找${nextResult.targetMemberLabel ?? '家人'}。`)
        await delay(280)
        navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
          state: {
            elderVoiceResult: nextResult,
            prefillDraft: nextResult.draftText,
            autoSendMessage: Boolean(nextResult.autoSendMessage) || shouldAutoExecute(nextResult),
          },
        })
        return
      }

      if (nextResult.nextAction === 'trigger_alert') {
        const alertType = nextResult.urgencyLevel === 'emergency' ? 'SOS' : 'UNWELL'
        await createAlert({
          familySpaceId,
          alertType,
          triggerSource: 'Voice',
          escalationLevel: nextResult.urgencyLevel === 'emergency' ? 2 : nextResult.urgencyLevel === 'attention' ? 2 : 1,
        })
        setFeedback(
          nextResult.urgencyLevel === 'emergency'
            ? '已经替你通知家人，现在会优先处理。'
            : '已经通知家人，请他们尽快联系你。'
        )
        await delay(280)
        navigate('/elder/help', { state: { elderVoiceResult: nextResult } })
        return
      }

      if (nextResult.nextAction === 'save_memory') {
        await createMemoryEntry({
          familySpaceId,
          sourceConvId: nextResult.targetConversationId,
          sourceMsgId: null,
          addedByMemberId: elderMemberId,
          memoryType: 'Text',
          title: '我想记住这句话',
          description: nextResult.draftText || nextResult.spokenText,
          mediaUrl: null,
        })
        setFeedback('已经帮你记下来了，之后你和家人都能再翻出来看。')
        await delay(280)
        navigate('/elder/home', { state: { elderVoiceResult: nextResult } })
        return
      }

      if (nextResult.nextAction === 'open_memories') {
        if (nextResult.targetConversationId) {
          setFeedback(`我带你去看看${nextResult.targetMemberLabel ?? '家人'}最近发来的内容。`)
          await delay(280)
          navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
            state: { elderVoiceResult: nextResult },
          })
          return
        }

        setFeedback('我先带你回到来信列表看看最近的内容。')
        await delay(280)
        navigate('/elder/inbox', { state: { elderVoiceResult: nextResult } })
        return
      }

      if (nextResult.nextAction === 'stay') {
        setFeedback(nextResult.assistantReply || '我在。你想继续说，就再点一次下面的麦克风。')
        setStage('result')
        return
      }

      setStage('result')
    } catch (actionError) {
      setStage('result')
      setError(actionError instanceof Error ? actionError.message : '这一步暂时没完成，请再试一次')
    }
  }

  function handleRetry() {
    setStage('transcribing')
    setResult(null)
    setFeedback('')
    setError('')
    setAssistantNotice('')
    spokenTextRef.current = spokenText
  }

  function resetAssistant() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current)
      audioObjectUrlRef.current = null
    }
    void stopRecording(false)
    setOpen(false)
    setStage('idle')
    setSpokenText('')
    spokenTextRef.current = ''
    setResult(null)
    setFeedback('')
    setError('')
    setAssistantNotice('')
    setIsRecording(false)
    wakeWordTriggeredRef.current = false
  }

  async function startWakeWordListening() {
    if (wakeWordSessionRef.current || typeof window === 'undefined') return

    if (Capacitor.isNativePlatform()) {
      const startedLocalWakeWord = await startLocalWakeWordListeningIfAvailable()
      if (!startedLocalWakeWord) {
        await startCloudWakeWordListening()
      }
      return
    }

    await startCloudWakeWordListening()
  }

  async function startLocalWakeWordListeningIfAvailable() {
    setWakeWordDebug(`本地听${WAKE_WORD} / ${SECONDARY_WAKE_WORD}`)

    const micReady = await ensureMicrophoneCapturePermission()
    if (!micReady || !wakeWordEnabledRef.current) {
      setWakeWordDebug(micReady ? '' : '麦克风未开')
      return false
    }

    const available = await isLocalWakeWordAvailable()
    if (!available || !wakeWordEnabledRef.current) {
      setWakeWordDebug('')
      return false
    }

    try {
      wakeWordSessionRef.current = await startLocalWakeWordListening({
        keywordSpec: WAKE_WORD_KEYWORD_SPEC,
        onDetected: () => {
          setWakeWordDebug('已唤醒')
          void handleWakeWordDetected()
        },
        onStatus: (status) => {
          if (status === 'listening') {
            setWakeWordDebug(`本地听${WAKE_WORD} / ${SECONDARY_WAKE_WORD}`)
          } else if (status === 'error') {
            setWakeWordDebug('监听失败')
            const activeWakeSession = wakeWordSessionRef.current
            wakeWordSessionRef.current = null
            void (async () => {
              await activeWakeSession?.stop()
              if (wakeWordEnabledRef.current && !wakeWordTriggeredRef.current) {
                scheduleWakeWordRestart(1200)
              }
            })()
          }
        },
      })
      return true
    } catch (error) {
      wakeWordSessionRef.current = null
      setWakeWordDebug('本地监听失败')
      console.warn('[Voice Assistant] local wake word failed:', error)
      return false
    }
  }

  async function startCloudWakeWordListening() {
    setWakeWordDebug('监听中')
    const micReady = await ensureMicrophoneCapturePermission()
    if (!micReady || !wakeWordEnabledRef.current) {
      setWakeWordDebug(micReady ? '' : '麦克风未开')
      return
    }

    let latestWakeTranscript = ''

    try {
      wakeWordSessionRef.current = await startRecordedSpeechRecognition({
        language: 'zh-CN',
        onFinalResult: (text) => {
          latestWakeTranscript = text.trim()
          if (containsWakeWord(latestWakeTranscript)) {
            setWakeWordDebug('已唤醒')
            void handleWakeWordDetected()
          } else if (latestWakeTranscript) {
            setWakeWordDebug(`听到：${latestWakeTranscript.slice(0, 12)}`)
            console.info('[Voice Assistant] wake word not matched:', latestWakeTranscript)
          }
        },
        onError: (message) => {
          setWakeWordDebug(`未听清：${message.slice(0, 10)}`)
          console.warn('[Voice Assistant] cloud wake word check skipped:', message)
        },
      })

      if (!wakeWordSessionRef.current) {
        setWakeWordDebug('未开始')
        scheduleWakeWordRestart(1200)
        return
      }

      setWakeWordDebug(`听${WAKE_WORD} / ${SECONDARY_WAKE_WORD}`)
      wakeWordRestartTimerRef.current = window.setTimeout(() => {
        const activeWakeSession = wakeWordSessionRef.current
        wakeWordSessionRef.current = null
        wakeWordRestartTimerRef.current = null

        void (async () => {
          await activeWakeSession?.stop()

          if (!wakeWordTriggeredRef.current && wakeWordEnabledRef.current) {
            scheduleWakeWordRestart(800)
          }
        })()
      }, 2200)
    } catch (error) {
      wakeWordSessionRef.current = null
      setWakeWordDebug('监听失败')
      console.warn('[Voice Assistant] cloud wake word failed:', error)
      if (wakeWordEnabledRef.current) {
        scheduleWakeWordRestart(1200)
      }
    }
  }

  async function stopWakeWordListening() {
    if (wakeWordRestartTimerRef.current !== null) {
      window.clearTimeout(wakeWordRestartTimerRef.current)
      wakeWordRestartTimerRef.current = null
    }

    const activeWakeSession = wakeWordSessionRef.current
    wakeWordSessionRef.current = null
    await activeWakeSession?.stop()
  }

  function scheduleWakeWordRestart(delayMs = 400) {
    if (typeof window === 'undefined' || wakeWordRestartTimerRef.current !== null) return

    wakeWordRestartTimerRef.current = window.setTimeout(() => {
      wakeWordRestartTimerRef.current = null
      if (wakeWordEnabledRef.current) {
        void startWakeWordListening()
      }
    }, delayMs)
  }

  async function handleWakeWordDetected() {
    if (!wakeWordEnabledRef.current || open || stage !== 'idle' || wakeWordTriggeredRef.current) return

    wakeWordTriggeredRef.current = true
    setWakeWordDebug('')

    await stopWakeWordListening()
    await delay(180)

    setOpen(true)
    setStage('recording')
    setFeedback('')
    setError('')
    setResult(null)
    setSpokenText('')
    spokenTextRef.current = ''
    setAssistantNotice(`${WAKE_WORD} / ${SECONDARY_WAKE_WORD} 已唤醒，我在，你继续说。`)
    const usedNativeWakeReply = await speakNativeWakeReply('我在')
    if (!usedNativeWakeReply) {
      speak('我在')
    }

    await delay(850)

    const started = await startRecording()
    if (!started) {
      wakeWordTriggeredRef.current = false
      setIsRecording(false)
      setStage('transcribing')
      setAssistantNotice('我在。你可以直接把想说的话补充进去。')
      return
    }

    setIsRecording(true)
    setAssistantNotice('我在听，你继续说。说完后我会自动继续。')
  }

  async function startRecording() {
    let startupErrorMessage = ''

    if (!Capacitor.isNativePlatform()) {
      const supportStatus = await getSpeechRecognitionSupportStatus()

      if (!supportStatus.supported) {
        setError(resolveSpeechRecognitionError(supportStatus.reason))
        return false
      }
    }

    try {
      const startSession = Capacitor.isNativePlatform()
        ? startRecordedSpeechRecognition
        : startSpeechRecognition

      speechSessionRef.current = await startSession({
        language: 'zh-CN',
        autoStopAfterSilenceMs: 2200,
        maxRecordingMs: 12000,
        onPartialResult: (text) => {
          if (text.trim()) {
            const normalizedText = text.trim()
            spokenTextRef.current = normalizedText
            setSpokenText(normalizedText)
          }
        },
        onFinalResult: (text) => {
          if (text.trim()) {
            const normalizedText = text.trim()
            spokenTextRef.current = normalizedText
            setSpokenText(normalizedText)
          }
        },
        onError: (message) => {
          startupErrorMessage = message
          setAssistantNotice(`这次没有听清：${message}`)
        },
        onListeningStateChange: (listening) => {
          if (!listening) {
            if (recordingFinishingRef.current) {
              setIsRecording(false)
              return
            }

            if (!speechSessionRef.current) {
              setIsRecording(false)
              return
            }

            recordingFinishingRef.current = true
            void finalizeRecording(true).finally(() => {
              recordingFinishingRef.current = false
            })
          }
        },
      })

      if (!speechSessionRef.current) {
        setError(resolveSpeechRecognitionStartupError(startupErrorMessage))
        return false
      }

      setAssistantNotice(Capacitor.isNativePlatform() ? '已经开始录音，说完后我会自动继续。' : '已经准备好了，你可以直接说。说完后我会自动继续。')
      setError('')
      return true
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : '录音启动失败')
      return false
    }
  }

  async function stopRecording(shouldTranscribe: boolean) {
    if (recordingFinishingRef.current) return
    recordingFinishingRef.current = true

    try {
      await speechSessionRef.current?.stop()
      await finalizeRecording(shouldTranscribe)
    } finally {
      recordingFinishingRef.current = false
    }
  }

  async function finalizeRecording(shouldTranscribe: boolean) {
    speechSessionRef.current = null
    setIsRecording(false)
    if (shouldTranscribe) {
      setStage('transcribing')
      if (spokenTextRef.current.trim()) {
        const transcript = spokenTextRef.current.trim()
        setAssistantNotice('已经帮你记下来了，马上开始理解。')
        setError('')
        await delay(240)
        await handleInterpret(transcript)
      } else {
        setAssistantNotice('我先把刚才的录音再整理一下。')
        setError('没有识别到有效语音，请再说一次')
      }
    }
  }

  async function resolveIntent(input: string) {
    try {
      const inferred = await inferElderIntent(input, members, conversations)
      setAssistantNotice('已使用服务端 AI 判断当前语音意图。')
      return inferred
    } catch (intentError) {
      console.warn('[Voice Assistant] AI intent fallback to local rules:', intentError)
      setAssistantNotice('我先用当前内容继续帮你处理。')
      return classifyElderSpeech(input, members, conversations)
    }
  }

  async function appendAiLog(
    text: string,
    senderType: 'System' | 'Elder' = 'System',
    senderMemberId: string | null = null,
  ) {
    if (!aiConversationId || !text.trim()) return
    try {
      await sendMessage(aiConversationId, {
        senderType,
        senderMemberId,
        messageType: 'Text',
        textContent: text.trim(),
        aiDrafted: false,
        isLowInformation: false,
      })
    } catch (logError) {
      console.warn('[Voice Assistant] failed to append AI log:', logError)
    }
  }

  function shouldAutoExecute(intent: ElderVoiceIntentResult) {
    if (intent.nextAction === 'clarify' || intent.nextAction === 'stay') return false
    if (intent.nextAction === 'open_conversation' && !intent.targetConversationId) return false
    return intent.confidence >= AUTO_EXECUTE_CONFIDENCE
  }

  function speak(text: string) {
    void speakWithFallback(text)
  }

  async function speakWithFallback(text: string) {
    const content = text?.trim()
    if (!content || typeof window === 'undefined') return

    try {
      const result = await synthesizeSpeech(content)
      const audio = audioRef.current ?? new Audio()
      const audioUrl = base64AudioToObjectUrl(result.audioBase64, result.mimeType)

      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current)
      }

      audioObjectUrlRef.current = audioUrl
      audio.pause()
      audio.src = audioUrl
      audio.preload = 'auto'
      audio.setAttribute('playsinline', 'true')
      audioRef.current = audio
      await audio.play()
      return
    } catch (error) {
      console.warn('[Voice Assistant] remote TTS fallback to system speech:', error)
    }

    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      setAssistantNotice('已经收到，但这台设备暂时没能把语音播出来。')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(content)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.onerror = () => {
      setAssistantNotice('已经收到，但这台设备暂时没能把语音播出来。')
    }
    window.speechSynthesis.speak(utterance)
  }

  async function ensureMicrophoneReady(options: { silent?: boolean } = {}) {
    if (micReadyRef.current) return true

    const ready = await ensureSpeechRecognitionPermission()
    if (!ready) {
      if (!options.silent) {
        setError('请先打开麦克风权限，再试一次。')
      }
      return false
    }

    micReadyRef.current = true
    return true
  }

  function getDefaultEdgePosition() {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 }
    }

    const buttonWidth = window.innerWidth <= 640 ? 50 : 54
    const buttonHeight = window.innerWidth <= 640 ? 68 : 74
    const desiredX = window.innerWidth - buttonWidth - 8
    const desiredY = window.innerHeight - buttonHeight - 164
    return clampEdgePosition(desiredX, desiredY)
  }

  function clampEdgePosition(x: number, y: number) {
    if (typeof window === 'undefined') {
      return { x, y }
    }

    const buttonRect = edgeButtonRef.current?.getBoundingClientRect()
    const buttonWidth = buttonRect?.width ?? (window.innerWidth <= 640 ? 50 : 54)
    const buttonHeight = buttonRect?.height ?? (window.innerWidth <= 640 ? 68 : 74)
    const margin = 8

    return {
      x: Math.min(Math.max(x, margin), Math.max(margin, window.innerWidth - buttonWidth - margin)),
      y: Math.min(Math.max(y, margin + 72), Math.max(margin, window.innerHeight - buttonHeight - margin - 12)),
    }
  }
}

function resolveButtonLabel(stage: AssistantStage) {
  if (stage === 'recording') return '点击结束说话'
  if (stage === 'classifying') return '正在理解'
  if (stage === 'acting') return '正在处理'
  return '点击开始说话'
}

function resolveSheetTitle(stage: AssistantStage, result: ElderVoiceIntentResult | null) {
  if (stage === 'recording') return '说完后再点一次，我先替你记下这句话'
  if (stage === 'transcribing') return '看看这句话对不对'
  if (stage === 'classifying') return '我在帮你判断该走哪条路'
  if (stage === 'acting') return '我在帮你把事情接下去'
  return result?.promptTitle ?? `说“${WAKE_WORD}”或“${SECONDARY_WAKE_WORD}”，我会出来听你说话`
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

function containsWakeWord(text: string) {
  const normalized = normalizeWakeWordText(text)
  if (!normalized) return false

  return WAKE_WORD_ALIASES.some((candidate) => normalized.includes(candidate))
}

function normalizeWakeWordText(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[^\u4e00-\u9fffa-zA-Z0-9]/g, '')
}

function base64AudioToObjectUrl(base64Data: string, mimeType: string) {
  const binary = window.atob(base64Data)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

function resolveSpeechRecognitionError(
  reason:
    | 'available'
    | 'native-unavailable'
    | 'native-error'
    | 'browser-unsupported'
    | 'browser-insecure-context'
    | 'browser-mic-unavailable',
) {
  if (reason === 'native-unavailable') {
    return '这台设备当前没有可用的语音识别服务，请检查系统语音输入功能。'
  }

  if (reason === 'native-error') {
    return '语音识别服务刚才没有正常启动，请稍后再试。'
  }

  if (reason === 'browser-insecure-context') {
    return '当前页面环境不支持语音识别，请在 App 内或安全连接下再试。'
  }

  if (reason === 'browser-mic-unavailable') {
    return '这台设备当前没有可用的麦克风输入能力。'
  }

  if (reason === 'browser-unsupported') {
    return '当前设备暂时不支持语音识别功能。'
  }

  return '当前暂时无法使用语音功能，请稍后再试。'
}

function resolveSpeechRecognitionStartupError(message: string) {
  const normalized = message.trim().toLowerCase()

  if (!normalized) {
    return '语音功能暂时没能打开，请稍后再试。'
  }

  if (
    normalized.includes('insufficient permissions') ||
    normalized.includes('missing permission') ||
    normalized.includes('permission')
  ) {
    return '请先打开麦克风权限，再试一次。'
  }

  if (normalized.includes('recognitionservice busy') || normalized.includes('busy')) {
    return '语音服务刚刚还在忙，请稍等一秒再试一次。'
  }

  if (normalized.includes('audio recording error') || normalized.includes('audio')) {
    return '麦克风刚才没有正常启动，请稍后再试。'
  }

  if (normalized.includes('network')) {
    return '语音识别服务刚才网络不稳定，请稍后再试。'
  }

  if (normalized.includes('no match') || normalized.includes('no speech')) {
    return '刚才没有听清你的声音，请再试一次。'
  }

  return `语音功能暂时没能打开：${message}`
}

