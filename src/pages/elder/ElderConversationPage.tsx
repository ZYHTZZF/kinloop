import { useEffect, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { createMemoryEntry, getConversationDetail, sendMessage } from '../../services/api'
import type { ConversationDetail, Message } from '../../services/api'
import { formatClock } from '../../utils/dateTime'
import type { ElderVoiceIntentResult } from '../../domain/elderVoice'
import { webrtcManager } from '../../services/webrtc/WebRTCManager'
import * as chatApi from '../../services/api/chatApi'
import VoiceCall from '../../components/chat/VoiceCall'
import VideoCall from '../../components/chat/VideoCall'

export function ElderConversationPage() {
  const location = useLocation()
  const { conversationId = 'daughter' } = useParams()
  const voiceResult = location.state?.elderVoiceResult as ElderVoiceIntentResult | undefined
  const prefillDraft = (location.state?.prefillDraft as string | undefined) ?? ''
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftText, setDraftText] = useState(prefillDraft || '这花挺好看的。')
  const [sending, setSending] = useState(false)
  const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null)
  const [memoryFeedback, setMemoryFeedback] = useState('')
  const [savingAiMemory, setSavingAiMemory] = useState(false)

  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'>('idle')
  const [isCallActive, setIsCallActive] = useState(false)
  const [callType, setCallType] = useState<'voice' | 'video'>('voice')
  const [isIncomingCall, setIsIncomingCall] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)

  const isCallerRef = useRef(false)
  const incomingOfferRef = useRef<any>(null)

  const currentUserId = 'elder-1'
  const otherUserId = conversationId // In Elder app, this serves as family member's ID mostly

  const logCallSystemMessage = async (content: string) => {
    if (!conversation) return;
    try {
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'System',
        senderMemberId: conversation.memberId,
        messageType: 'Text',
        textContent: content,
        aiDrafted: false,
        isLowInformation: false,
      })
      setConversation(nextConversation)
    } catch(err) {
      console.error('Failed to log system message', err)
    }
  }

  useEffect(() => {
    // 建立 Socket
    const initWS = async () => {
      if (!chatApi.isWebSocketConnected()) {
        try {
          await chatApi.initWebSocket('ws://localhost:3001', currentUserId)
        } catch(e) {}
      }
    }
    initWS()

    // 绑定 WebRTC 信号层
    webrtcManager.setSignalingClient(async (signal) => {
      chatApi.sendWebrtcSignal({ ...signal, to: otherUserId, from: currentUserId })
    })
    
    // 监听 WebSocket 收到的 WebRTC 信号
    chatApi.setWebrtcSignalHandler(async (signal) => {
      if (signal.type === 'offer') {
        isCallerRef.current = false
        incomingOfferRef.current = signal.data.sdp
        setIsCallActive(true)
        setCallType(signal.callType || 'voice')
        setCallState('ringing')
        setIsIncomingCall(true)
      } else if (signal.type === 'answer') {
        await webrtcManager.handleAnswer(signal.data.sdp)
      } else if (signal.type === 'ice-candidate') {
        await webrtcManager.handleIceCandidate(signal.data)
      } else if (signal.type === 'reject') {
        if (isCallerRef.current) logCallSystemMessage('📞 对方已拒绝通话')
        setIsCallActive(false)
        setCallState('idle')
      } else if (signal.type === 'hangup') {
        webrtcManager.hangup()
        setIsCallActive(false)
        setCallState('ended')
        setTimeout(() => setCallState('idle'), 500)
      }
    })

    const unsubscribeConnected = webrtcManager.on('connection-state-changed', (data) => {
      if (data.state === 'connected') setCallState('connected')
    })
    const unsubscribeEnded = webrtcManager.on('call-ended', (data) => {
      setCallState('ended')
      setIsCallActive(false)
      setCallDuration(0)
      setTimeout(() => setCallState('idle'), 500)

      if (isCallerRef.current && data && data.duration !== undefined && callState === 'connected') {
        const durationSecs = Math.round(data.duration / 1000)
        logCallSystemMessage(`📞 通话结束，时长: ${durationSecs}秒`)
      } else if (isCallerRef.current) {
        logCallSystemMessage('📞 通话已取消')
      }
    })

    return () => {
      unsubscribeConnected()
      unsubscribeEnded()
    }
  }, [currentUserId, otherUserId, conversation, callState])

  const handleAcceptCall = async () => {
    try {
      setCallState('connecting')
      if (incomingOfferRef.current) {
        await webrtcManager.acceptCall(currentUserId, { type: 'offer', sdp: incomingOfferRef.current } as any, otherUserId, callType, `${otherUserId}-${currentUserId}`)
      }
    } catch (e) {
      setIsCallActive(false)
      setCallState('idle')
    }
  }

  const handleRejectCall = async () => {
    await webrtcManager.rejectCall(currentUserId, otherUserId, 'call-id')
    setIsCallActive(false)
    setCallState('idle')
  }

  const handleHangupCall = () => {
    webrtcManager.hangup()
    setIsCallActive(false)
    setCallState('ended')
  }

  const handleInitiateVoiceCall = async () => {
    isCallerRef.current = true
    setIsCallActive(true); setCallType('voice'); setCallState('ringing'); setIsIncomingCall(false);
    await webrtcManager.initiateCall(currentUserId, otherUserId, 'voice')
  }

  const handleInitiateVideoCall = async () => {
    isCallerRef.current = true
    setIsCallActive(true); setCallType('video'); setCallState('ringing'); setIsIncomingCall(false);
    await webrtcManager.initiateCall(currentUserId, otherUserId, 'video')
  }

  useEffect(() => {
    if (prefillDraft) {
      setDraftText(prefillDraft)
    }
  }, [prefillDraft])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const nextConversation = await getConversationDetail(conversationId)
        if (!cancelled) {
          setConversation(nextConversation)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载会话失败')
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
  }, [conversationId])

  const messages = conversation?.messages ?? []
  const familyMessageCount = messages.filter((message) => message.senderType === 'Family').length

  return (
    <section className="screen screen--elder-conversation">
      <section className="surface-card">
        <header className="detail-header">
          <Link className="back-link" to="/elder/inbox">
            ← 返回
          </Link>
          {conversation ? (
            <div className="detail-header__identity" style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="avatar-badge">{conversation.avatar}</span>
                <div>
                  <p className="surface-card__eyebrow">正在和谁说话</p>
                  <h2>{conversation.name}</h2>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', paddingRight: '16px' }}>
                <button onClick={handleInitiateVoiceCall} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="语音通话">📞</button>
                <button onClick={handleInitiateVideoCall} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="视频通话">📹</button>
              </div>
            </div>
          ) : null}
        </header>

        {isCallActive && callType === 'voice' && (
          <VoiceCall
            remoteUser={{ id: otherUserId, name: conversation?.name || '家人', avatar: conversation?.avatar }}
            callState={callState}
            duration={callDuration}
            isIncoming={isIncomingCall}
            isMuted={isMuted}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
            onHangup={handleHangupCall}
            onToggleMute={(m) => setIsMuted(m)}
          />
        )}
        {isCallActive && callType === 'video' && (
          <VideoCall
            remoteUser={{ id: otherUserId, name: conversation?.name || '家人', avatar: conversation?.avatar }}
            remoteStream={webrtcManager.getRemoteStream()}
            localStream={webrtcManager.getLocalStream()}
            callState={callState}
            duration={callDuration}
            isIncoming={isIncomingCall}
            isMuted={isMuted}
            isCameraOn={isCameraOn}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
            onHangup={handleHangupCall}
            onToggleMute={(m) => setIsMuted(m)}
            onToggleCamera={(c) => setIsCameraOn(c)}
          />
        )}

        {loading ? (
          <PageState
            title="正在打开这段家人对话"
            description="稍等一下，我把这位家人最近送来的话一条条摆好。"
          />
        ) : null}
        {error ? (
          <PageState
            variant="error"
            title="这段对话暂时没有连上本地服务"
            description={error}
          />
        ) : null}
        {voiceResult ? <p className="state-note">{voiceResult.promptTitle}</p> : null}
        {memoryFeedback ? <p className="state-note">{memoryFeedback}</p> : null}

        {conversation ? (
          <article className="conversation-rhythm-card">
            <div>
              <span className="surface-card__eyebrow">这段对话的节奏</span>
              <strong>{conversation.name} 这次先送来内容，再等你慢慢回应。</strong>
            </div>
            <p>当前已经看到 {familyMessageCount} 条来自家人的内容。你可以先听完、看完，再决定是否用 AI 帮你回一句。</p>
          </article>
        ) : null}

        <div className="message-list">
          {!loading && !error && messages.length === 0 ? (
            <PageState
              title="这段对话现在还是空的"
              description="等家人发来一句话，或者你先请 AI 帮你回一句，这里就会开始慢慢展开。"
            />
          ) : null}

          {messages.map((message) => (
            <article
              key={message.id}
              className={`message-bubble message-bubble--${message.senderType === 'Family' ? 'family' : 'elder'}`}
            >
              <span className="message-bubble__sender">
                {getSenderLabel(message, conversation?.name ?? '家人')}
              </span>
              {message.messageType === 'Image' ? (
                <div className="message-media">
                  <span>{message.mediaUrl ?? '图片内容'}</span>
                </div>
              ) : null}
              <p>{message.textContent ?? message.transcript ?? '发来一段语音'}</p>
              <footer className="message-bubble__footer">
                <span>{formatClock(message.createdAt)}</span>
                {message.senderType === 'Family' ? (
                  <button
                    className="text-action"
                    type="button"
                    disabled={savingMemoryId === message.id}
                    onClick={() => void handleAddMemory(message)}
                  >
                    {savingMemoryId === message.id ? '保存中…' : '✨ 加入回忆'}
                  </button>
                ) : null}
                {message.aiDrafted ? <span className="status-pill">AI 代发</span> : null}
              </footer>
            </article>
          ))}
        </div>

        {conversation ? (
          <form className="ai-confirm-card" onSubmit={handleSubmitReply}>
            <p className="surface-card__eyebrow">AI 代发确认</p>
            <strong>准备告诉【{conversation.name}】：</strong>
            <input
              aria-label="AI 代发内容"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
            />
            <div className="inline-actions">
              <button className="ghost-action" type="button">
                修改
              </button>
              <button
                className="ghost-action"
                type="button"
                disabled={savingAiMemory || !draftText.trim()}
                onClick={() => void handleAddAiMemory()}
              >
                {savingAiMemory ? '记下中…' : '帮我记下来'}
              </button>
              <button className="primary-action" type="submit" disabled={sending || !draftText.trim()}>
                {sending ? '发送中…' : '发送'}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </section>
  )

  async function handleSubmitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!conversation || !draftText.trim()) {
      return
    }

    try {
      setSending(true)
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'Elder',
        senderMemberId: 'member_elder',
        messageType: 'Text',
        textContent: draftText.trim(),
        aiDrafted: true,
        isLowInformation: isLowInformation(draftText),
      })
      setConversation(nextConversation)
      setError('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'AI 代发失败')
    } finally {
      setSending(false)
    }
  }

  async function handleAddMemory(message: Message) {
    if (!conversation) {
      return
    }

    try {
      setSavingMemoryId(message.id)
      await createMemoryEntry({
        familySpaceId: 'fs_demo',
        sourceConvId: conversation.id,
        sourceMsgId: message.id,
        addedByMemberId: 'member_elder',
        memoryType: toMemoryType(message.messageType),
        title: buildFamilyMemoryTitle(conversation.name, message),
        description: message.textContent ?? message.transcript ?? '一段值得留住的内容',
        mediaUrl: message.mediaUrl,
      })
      setMemoryFeedback('这条回应已经记进回忆里了。')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '加入回忆失败')
    } finally {
      setSavingMemoryId(null)
    }
  }

  async function handleAddAiMemory() {
    if (!draftText.trim()) {
      return
    }

    try {
      setSavingAiMemory(true)
      await createMemoryEntry({
        familySpaceId: 'fs_demo',
        sourceConvId: conversation?.id ?? null,
        sourceMsgId: null,
        addedByMemberId: 'member_elder',
        memoryType: 'Text',
        title: '我想记住这句话',
        description: draftText.trim(),
        mediaUrl: null,
      })
      setMemoryFeedback('AI 已经帮你把这句话记到回忆里。')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'AI 加入回忆失败')
    } finally {
      setSavingAiMemory(false)
    }
  }
}

function getSenderLabel(message: Message, familyName: string) {
  if (message.senderType === 'Family') {
    return familyName
  }

  return '我'
}

function isLowInformation(input: string) {
  const normalized = input.trim()
  return ['嗯', '好', '好的', '收到', '知道了', '行'].includes(normalized)
}

function toMemoryType(messageType: string) {
  if (messageType === 'Image') return 'Image'
  if (messageType === 'Voice') return 'Voice'
  return 'Text'
}

function buildFamilyMemoryTitle(familyName: string, message: Message) {
  if (message.messageType === 'Image') {
    return `${familyName}发来的一张照片`
  }

  if (message.messageType === 'Voice') {
    return `${familyName}留给我的一段语音`
  }

  return `${familyName}说的一句话`
}
