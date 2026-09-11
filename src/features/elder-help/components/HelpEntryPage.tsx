import { useEffect, useRef, useState } from 'react'
import { FeatureEntryScaffold } from '../../../components/common/FeatureEntryScaffold'
import { helpRequests } from '../data/helpData'
import { summarizeHelpSpeech } from '../services/summarizeHelpSpeech'
import type { HelpRequestRecord, SupportChannel } from '../types'

type HelpEntryPageProps = {
  onBack: () => void
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: { transcript: string }
    isFinal?: boolean
    length: number
  }>
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

type QuickScenario = {
  label: string
  title: string
  summary: string
  actionLabel: string
  channel: SupportChannel
  responseGoal: string
}

const HELP_STORAGE_KEY = 'kinloop-c-help-requests'

const channelLabelMap = {
  family: '家人',
  neighbor: '邻里',
  service: '人工支持',
  emergency: '紧急通道',
} as const

const stageLabelMap = {
  triaged: '已发出',
  contacting: '有人处理中',
  scheduled: '已安排帮助',
  resolved: '已收到回应',
} as const

const quickScenarios: QuickScenario[] = [
  {
    label: '我想找家里人',
    title: '想联系家人',
    summary: '老人希望尽快联系家人。',
    actionLabel: '联系家人',
    channel: 'family',
    responseGoal: '尽快确认家属是否在线',
  },
  {
    label: '我有点不舒服',
    title: '身体不舒服，需要尽快关注',
    summary: '老人表示身体不适，需要尽快有人接住。',
    actionLabel: '紧急升级',
    channel: 'emergency',
    responseGoal: '5 分钟内确认是否需要紧急处理',
  },
  {
    label: '药找不到了',
    title: '用药相关求助',
    summary: '老人找不到药物或担心漏服，需要协助确认。',
    actionLabel: '社区协助',
    channel: 'service',
    responseGoal: '30 分钟内确认药物情况',
  },
  {
    label: '我一个人有点慌',
    title: '需要有人陪一会儿',
    summary: '老人需要有人回应和陪伴。',
    actionLabel: '联系家人',
    channel: 'family',
    responseGoal: '尽快建立通话或回电',
  },
]

const sectionStyle = {
  display: 'grid',
  gap: '12px',
} as const

const heroStyle = {
  display: 'grid',
  gap: '16px',
  padding: '22px',
  borderRadius: '24px',
  background: 'linear-gradient(135deg, #f7fbff 0%, #eef3ff 100%)',
  border: '1px solid rgba(80, 115, 215, 0.16)',
} as const

const heroActionsStyle = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
} as const

const quickButtonStyle = {
  padding: '18px 20px',
  border: '1px solid rgba(86, 104, 147, 0.16)',
  borderRadius: '18px',
  background: '#fff',
  color: '#1e2440',
  textAlign: 'left' as const,
} as const

const primaryButtonStyle = {
  padding: '14px 18px',
  border: 0,
  borderRadius: '16px',
  background: '#3d57a8',
  color: '#fff',
} as const

const secondaryButtonStyle = {
  padding: '12px 16px',
  border: '1px solid rgba(86, 104, 147, 0.16)',
  borderRadius: '16px',
  background: '#fff',
  color: '#34425f',
} as const

const textareaStyle = {
  padding: '14px 16px',
  border: '1px solid rgba(86, 104, 147, 0.16)',
  borderRadius: '16px',
  background: '#fff',
  color: '#1e2440',
  minHeight: '96px',
  resize: 'vertical' as const,
} as const

function detectSpeechRecognition(): SpeechRecognitionConstructor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

function buildScenarioRequest(scenario: QuickScenario): Omit<HelpRequestRecord, 'id'> {
  return {
    requester: '老人本人',
    title: scenario.title,
    summary: scenario.summary,
    channel: scenario.channel,
    stage: scenario.channel === 'emergency' ? 'contacting' : 'triaged',
    responseGoal: scenario.responseGoal,
    lastUpdate: `刚刚发出求助，已按“${scenario.actionLabel}”记录`,
  }
}

export function HelpEntryPage({ onBack }: HelpEntryPageProps) {
  const [requests, setRequests] = useState<HelpRequestRecord[]>(() => {
    if (typeof window === 'undefined') return helpRequests

    const stored = window.localStorage.getItem(HELP_STORAGE_KEY)
    if (!stored) return helpRequests

    try {
      const parsed = JSON.parse(stored) as HelpRequestRecord[]
      return parsed.length > 0 ? parsed : helpRequests
    } catch {
      return helpRequests
    }
  })
  const [voiceDraft, setVoiceDraft] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const activeCount = requests.filter((item) => item.stage !== 'resolved').length
  const recentRequests = requests.slice(0, 4)

  useEffect(() => {
    const Recognition = detectSpeechRecognition()
    setSpeechSupported(Boolean(Recognition))

    if (!Recognition) return

    const recognition = new Recognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'zh-CN'
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join('')
        .trim()

      setVoiceDraft(transcript)
      setSummaryError('')
    }
    recognition.onerror = () => {
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem(HELP_STORAGE_KEY, JSON.stringify(requests))
    window.dispatchEvent(new CustomEvent('kinloop-help-updated'))
  }, [requests])

  const addRequest = (request: Omit<HelpRequestRecord, 'id'>) => {
    setRequests((current) => [{ ...request, id: `help-${Date.now()}` }, ...current])
  }

  const submitScenario = (scenario: QuickScenario) => {
    addRequest(buildScenarioRequest(scenario))
  }

  const toggleListening = () => {
    const recognition = recognitionRef.current

    if (!recognition) return

    if (isListening) {
      recognition.stop()
      setIsListening(false)
      return
    }

    setVoiceDraft('')
    setSummaryError('')
    setIsListening(true)
    recognition.start()
  }

  const submitVoiceRequest = async () => {
    const text = voiceDraft.trim()

    if (!text) return

    setIsSummarizing(true)
    setSummaryError('')

    try {
      const result = await summarizeHelpSpeech(text)
      addRequest({
        requester: '老人本人',
        title: result.title,
        summary: result.summary,
        originalText: result.originalText,
        channel: result.channel,
        stage: result.channel === 'emergency' ? 'contacting' : 'triaged',
        responseGoal: result.responseGoal,
        lastUpdate: '刚刚发出求助，系统已整理后发送',
      })
      setVoiceDraft('')
    } catch {
      setSummaryError('这次发送没有成功，可以稍后再试。')
    } finally {
      setIsSummarizing(false)
    }
  }

  return (
    <FeatureEntryScaffold
      eyebrow="找人帮忙"
      title="长辈端 · 找人帮忙"
      summary="需要帮助的时候，先从这里快速发出求助。"
      owner="长辈端求助负责人"
      path="src/features/elder-help"
      notes={[
        '上面先发求助，下面再看最近记录。',
        '常用求助和语音求助都放在主操作区。',
      ]}
      onBack={onBack}
    >
      <section style={heroStyle}>
        <div>
          <span className="page-shell__eyebrow">马上求助</span>
          <h3 style={{ margin: '0 0 6px' }}>先把这件事发出去</h3>
          <p style={{ margin: 0, color: '#53607a' }}>{activeCount} 条求助正在处理中。</p>
        </div>

        <div style={heroActionsStyle}>
          {quickScenarios.map((scenario) => (
            <button
              key={scenario.label}
              style={quickButtonStyle}
              type="button"
              onClick={() => submitScenario(scenario)}
            >
              <strong>{scenario.label}</strong>
              <p>{scenario.summary}</p>
            </button>
          ))}
        </div>

        <article className="list-panel" style={sectionStyle}>
          <span>语音求助</span>
          <strong>如果一句话说不清，可以直接说</strong>
          <div className="action-row">
            <button style={primaryButtonStyle} type="button" onClick={toggleListening} disabled={!speechSupported}>
              {speechSupported ? (isListening ? '停止录音' : '开始说话') : '当前浏览器不支持语音识别'}
            </button>
            <button
              style={secondaryButtonStyle}
              type="button"
              onClick={submitVoiceRequest}
              disabled={!voiceDraft.trim() || isSummarizing}
            >
              {isSummarizing ? '正在发送...' : '发送给家人'}
            </button>
          </div>
          <textarea
            style={textareaStyle}
            value={voiceDraft}
            onChange={(event) => {
              setVoiceDraft(event.target.value)
              setSummaryError('')
            }}
            placeholder="例如：我刚刚吃完饭有点头晕，想找女儿说一下。"
          />
          {summaryError ? (
            <article className="list-panel">
              <strong>发送失败</strong>
              <p>{summaryError}</p>
            </article>
          ) : null}
        </article>
      </section>

      <section className="stack-list">
        <article className="list-panel">
          <span>最近求助</span>
          <strong>看看最近发出去的内容</strong>
        </article>

        {recentRequests.map((request) => (
          <article className="list-panel" key={request.id}>
            <span>
              {request.requester} · {channelLabelMap[request.channel]} · {stageLabelMap[request.stage]}
            </span>
            <strong>{request.title}</strong>
            <p>{request.summary}</p>
            <p>当前状态：{request.lastUpdate}</p>
          </article>
        ))}
      </section>
    </FeatureEntryScaffold>
  )
}
