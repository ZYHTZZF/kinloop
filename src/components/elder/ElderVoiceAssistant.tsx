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
  sendMessage,
} from '../../services/api'
import type { ConversationCard, Member } from '../../services/api'
import { ensureSpeechRecognitionPermission } from '../../platform/permissions'
import {
  isSpeechRecognitionSupported,
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

export function ElderVoiceAssistant() {
  const navigate = useNavigate()
  const location = useLocation()
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

  const micReadyRef = useRef(false)
  const speechSessionRef = useRef<SpeechSession | null>(null)

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
      setError(loadError instanceof Error ? loadError.message : '暂时没连上本地服务')
    }
  }

  async function handleVoiceToggle() {
    if (stage === 'classifying' || stage === 'acting') return

    if (isRecording) {
      await stopRecording(true)
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
    await appendAiLog(spokenText.trim(), 'Elder', elderMemberId)

    await delay(420)
    const nextResult = await resolveIntent(spokenText)
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
        const shouldSendNow = Boolean(nextResult.autoSendMessage)
        const messageText = nextResult.draftText.trim()

        if (shouldSendNow && messageText) {
          await sendMessage(nextResult.targetConversationId, {
            senderType: 'Elder',
            senderMemberId: elderMemberId,
            messageType: 'Text',
            textContent: messageText,
            aiDrafted: true,
            isLowInformation: false,
          })
          await loadDirectory()
          setFeedback(`已经帮你把“${messageText}”发给${nextResult.targetMemberLabel ?? '家人'}了。`)
          await delay(280)
          navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
            state: {
              elderVoiceResult: nextResult,
              prefillDraft: '',
              autoSendMessage: false,
            },
          })
          return
        }

        setFeedback(`我这就带你去找${nextResult.targetMemberLabel ?? '家人'}。`)
        await delay(280)
        navigate(`/elder/conversations/${nextResult.targetConversationId}`, {
          state: {
            elderVoiceResult: nextResult,
            prefillDraft: nextResult.draftText,
            autoSendMessage: false,
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
  }

  function resetAssistant() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    void stopRecording(false)
    setOpen(false)
    setStage('idle')
    setSpokenText('')
    setResult(null)
    setFeedback('')
    setError('')
    setAssistantNotice('')
    setIsRecording(false)
  }

  async function startRecording() {
    const supportsSpeechRecognition = await isSpeechRecognitionSupported()

    if (!supportsSpeechRecognition) {
      setError('当前环境不支持语音识别，请安装语音服务或改用支持的浏览器/系统')
      return false
    }

    try {
      speechSessionRef.current = await startSpeechRecognition({
        language: 'zh-CN',
        onPartialResult: (text) => {
          if (text.trim()) {
            setSpokenText(text.trim())
          }
        },
        onFinalResult: (text) => {
          if (text.trim()) {
            setSpokenText(text.trim())
          }
        },
        onError: (message) => {
          setAssistantNotice(`语音识别暂时不可用：${message}`)
        },
        onListeningStateChange: (listening) => {
          if (!listening) {
            setIsRecording(false)
          }
        },
      })

      if (!speechSessionRef.current) {
        setError('语音识别启动失败，请检查系统语音服务和权限设置')
        return false
      }

      setAssistantNotice('已开启语音识别，请直接说出你想表达的内容。')
      setError('')
      return true
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : '录音启动失败')
      return false
    }
  }

  async function stopRecording(shouldTranscribe: boolean) {
    try {
      await speechSessionRef.current?.stop()
    } finally {
      speechSessionRef.current = null
      setIsRecording(false)
      if (shouldTranscribe) {
        if (spokenText.trim()) {
          setAssistantNotice('已完成语音识别，请确认文字是否正确。')
          setError('')
        } else {
          setError('没有识别到有效语音，请再说一次')
        }
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
      setAssistantNotice('服务端 AI 暂时不可用，已切换到本地规则继续处理。')
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
    if (typeof window === 'undefined') return
    const content = text?.trim()
    if (!content) return
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(content)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  }

  async function ensureMicrophoneReady() {
    if (micReadyRef.current) return true

    const ready = await ensureSpeechRecognitionPermission()
    if (!ready) {
      setError('语音权限未开启，请在系统或浏览器设置里允许麦克风/语音识别')
      return false
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
