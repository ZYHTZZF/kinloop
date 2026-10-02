import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { classifyElderSpeech, type ElderVoiceIntentResult } from '../../domain/elderVoice'
import {
  createAlert,
  createMemoryEntry,
  getCurrentFamilySpace,
  inferElderIntent,
  listConversationCards,
  listMembers,
} from '../../services/api'
import type { ConversationCard, Member } from '../../services/api'

const examplePrompts = [
  '我想和女儿说句话',
  '我今天有点不舒服',
  '我就是想说说话',
  '帮我把这句话记下来',
]

type AssistantStage = 'idle' | 'recording' | 'transcribing' | 'classifying' | 'result' | 'acting'

type SpeechRecognitionResultLike = {
  0: { transcript: string }
  isFinal: boolean
  length: number
}

type SpeechRecognitionEventLike = Event & {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionLike = EventTarget & {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event & { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null

  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }

  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null
}

export function ElderVoiceAssistant() {
  const navigate = useNavigate()
  const location = useLocation()
  const [members, setMembers] = useState<Member[]>([])
  const [conversations, setConversations] = useState<ConversationCard[]>([])
  const [familySpaceId, setFamilySpaceId] = useState('fs_demo')
  const [elderMemberId, setElderMemberId] = useState('member_elder')
  const [stage, setStage] = useState<AssistantStage>('idle')
  const [open, setOpen] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const [result, setResult] = useState<ElderVoiceIntentResult | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [assistantNotice, setAssistantNotice] = useState('')
  const [isRecording, setIsRecording] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const shouldTranscribeOnStopRef = useRef(false)
  const micReadyRef = useRef(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalTranscriptRef = useRef('')
  const liveTranscriptRef = useRef('')

  useEffect(() => {
    void loadDirectory()
  }, [])

  useEffect(() => {
    resetAssistant()
  }, [location.pathname])

  return (
    <>
      <button
        className={`global-voice-button${isRecording ? ' is-holding' : ''}`}
        type="button"
        aria-label={resolveButtonLabel(stage)}
        onClick={() => void handleVoiceToggle()}
      >
        <span className="global-voice-button__mic">🎙</span>
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

          {error ? <p className="state-note state-note--error">{error}</p> : null}
          {assistantNotice ? <p className="state-note">{assistantNotice}</p> : null}

          {stage === 'recording' ? (
            <div className="voice-sheet__status-card">
              <strong>麦克风正在工作</strong>
              <p>再点一次麦克风按钮结束录音并开始转写。</p>
              {spokenText ? <p>{spokenText}</p> : null}
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
              <p>{feedback || result.promptBody}</p>

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
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '暂时没连上本地服务')
    }
  }

  async function handleVoiceToggle() {
    if (stage === 'classifying' || stage === 'acting') return

    if (isRecording) {
      stopRecording(true)
      setIsRecording(false)
      setStage('transcribing')
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
    setAssistantNotice('')
    setIsRecording(true)
  }

  async function handleInterpret() {
    if (!spokenText.trim()) return

    setStage('classifying')
    setError('')
    setFeedback('')
    setAssistantNotice('')

    await delay(420)
    const nextResult = await resolveIntent(spokenText)
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
        setFeedback(`我这就带你去找${nextResult.targetMemberLabel ?? '家人'}。`)
        await delay(280)
        navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
          state: {
            elderVoiceResult: nextResult,
            prefillDraft: nextResult.draftText,
            autoSendMessage: nextResult.autoSendMessage,
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
        setFeedback('我在。你想继续说，就再点一次下面的麦克风。')
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
  }

  function resetAssistant() {
    stopRecording(false)
    setOpen(false)
    setStage('idle')
    setSpokenText('')
    setResult(null)
    setFeedback('')
    setError('')
    setAssistantNotice('')
    setIsRecording(false)
    finalTranscriptRef.current = ''
    liveTranscriptRef.current = ''
  }

  async function startRecording() {
    const speechRecognitionCtor = getSpeechRecognitionCtor()
    const supportsMediaRecorder = typeof MediaRecorder !== 'undefined'

    if (!supportsMediaRecorder && !speechRecognitionCtor) {
      setError('当前浏览器不支持录音或语音识别，请使用最新版 Chrome 或 Edge')
      return false
    }

    try {
      finalTranscriptRef.current = ''
      liveTranscriptRef.current = ''
      audioChunksRef.current = []
      shouldTranscribeOnStopRef.current = true

      if (speechRecognitionCtor) {
        const recognition = new speechRecognitionCtor()
        recognition.lang = 'zh-CN'
        recognition.continuous = true
        recognition.interimResults = true
        recognition.onresult = (event) => {
          let finalText = finalTranscriptRef.current
          let interimText = ''

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index]
            const transcript = result?.[0]?.transcript ?? ''
            if (result?.isFinal) {
              finalText += transcript
            } else {
              interimText += transcript
            }
          }

          finalTranscriptRef.current = finalText
          liveTranscriptRef.current = `${finalText}${interimText}`.trim()
          if (liveTranscriptRef.current) {
            setSpokenText(liveTranscriptRef.current)
          }
        }
        recognition.onerror = (event) => {
          const errorCode = event.error ?? ''
          if (errorCode && errorCode !== 'no-speech') {
            setAssistantNotice(`浏览器语音识别暂时不可用：${errorCode}`)
          }
        }
        recognition.onend = () => {
          recognitionRef.current = null
        }
        recognition.start()
        recognitionRef.current = recognition
      }

      if (supportsMediaRecorder) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream

        const preferredMimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm'

        let recorder: MediaRecorder
        try {
          recorder = new MediaRecorder(stream, { mimeType: preferredMimeType })
        } catch {
          recorder = new MediaRecorder(stream)
        }

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }
        recorder.onerror = () => {
          setError('录音失败，请检查麦克风权限和输入设备')
        }
        recorder.onstop = () => {
          const shouldTranscribe = shouldTranscribeOnStopRef.current
          stopStreamTracks()
          setIsRecording(false)
          setStage((prev) => (prev === 'recording' ? 'transcribing' : prev))
          if (shouldTranscribe) {
            void transcribeRecordedAudio(recorder.mimeType)
          } else {
            audioChunksRef.current = []
          }
        }
        recorder.start(250)
        mediaRecorderRef.current = recorder
      }

      setAssistantNotice(
        speechRecognitionCtor
          ? '已开启麦克风，正在边录音边识别语音。'
          : '已开启麦克风录音，结束后会走服务端转写。'
      )
      setError('')
      return true
    } catch (recordError) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      setError(recordError instanceof Error ? recordError.message : '录音启动失败')
      return false
    }
  }

  function stopRecording(shouldTranscribe: boolean) {
    shouldTranscribeOnStopRef.current = shouldTranscribe
    recognitionRef.current?.stop()

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.requestData()
        mediaRecorderRef.current.stop()
      } else {
        stopStreamTracks()
        setIsRecording(false)
        if (shouldTranscribe) {
          void transcribeRecordedAudio('')
        }
      }
    } catch {
      stopStreamTracks()
    }

    mediaRecorderRef.current = null
  }

  function stopStreamTracks() {
    if (!mediaStreamRef.current) return
    mediaStreamRef.current.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }

  async function transcribeRecordedAudio(mimeType: string) {
    try {
      const browserTranscript = finalTranscriptRef.current.trim() || liveTranscriptRef.current.trim()
      if (browserTranscript) {
        setSpokenText(browserTranscript)
        setAssistantNotice('已使用浏览器语音识别完成转写。')
        setError('')
        return
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
      audioChunksRef.current = []
      if (audioBlob.size <= 0) {
        setError('没有采集到有效声音，请靠近麦克风后再试一次')
        return
      }

      const audioBase64 = await blobToBase64(audioBlob)
      const response = await fetch('/api/asr/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type || 'audio/webm',
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: '转写服务不可用' }))
        throw new Error(String(payload?.error ?? '转写失败'))
      }

      const payload = await response.json() as { text?: string }
      const text = String(payload.text ?? '').trim()
      if (!text) {
        setError('没有识别到有效语音，请再说一次')
        return
      }

      setSpokenText(text)
      setAssistantNotice('已使用服务端语音转写完成识别。')
      setError('')
    } catch (transcribeError) {
      setError(transcribeError instanceof Error ? transcribeError.message : '语音转写失败')
    }
  }

  async function resolveIntent(input: string) {
    try {
      const inferred = await inferElderIntent(input, members, conversations)
      setAssistantNotice('已使用服务端 AI 判断当前语音意图。')
      return inferred
    } catch (intentError) {
      console.warn('[Voice Assistant] AI intent fallback to local rules:', intentError)
      setAssistantNotice('服务端 AI 暂时不可用，已切换到本地规则继续处理。')
      return classifyElderSpeech(input, members, conversations)
    }
  }

  async function ensureMicrophoneReady() {
    if (micReadyRef.current) return true

    const host = window.location.hostname
    if (!window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1') {
      setError('需要 HTTPS 或 localhost 才能使用麦克风')
      return false
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('当前浏览器不支持麦克风能力')
      return false
    }

    try {
      const permissionApi = navigator.permissions as Permissions | undefined
      if (permissionApi?.query) {
        const status = await permissionApi.query({ name: 'microphone' as PermissionName })
        if (status.state === 'denied') {
          setError('麦克风权限已被阻止，请在地址栏设置里改成允许')
          return false
        }
      }
    } catch {
      // ignore
    }

    micReadyRef.current = true
    return true
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
  return result?.promptTitle ?? '点下面的麦克风，说出你想说的话'
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

async function blobToBase64(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('无法读取录音内容'))
        return
      }
      const commaIndex = reader.result.indexOf(',')
      resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result)
    }
    reader.onerror = () => reject(new Error('录音编码失败'))
    reader.readAsDataURL(blob)
  })
}
