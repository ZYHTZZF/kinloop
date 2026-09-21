import { useEffect, useState, useRef } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { createMemoryEntry, getConversationDetail, sendMessage } from '../../services/api'
import type { ConversationDetail, Message } from '../../services/api'
import { formatClock } from '../../utils/dateTime'
import { webrtcManager } from '../../services/webrtc/WebRTCManager'
import * as chatApi from '../../services/api/chatApi'
import VoiceCall from '../../components/chat/VoiceCall'
import VideoCall from '../../components/chat/VideoCall'

export function FamilyConversationPage() {
  const { conversationId = 'daughter', userId } = useParams()
  const targetId = userId || conversationId
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerText, setComposerText] = useState('')
  const [sending, setSending] = useState(false)
  const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null)
  const [memoryFeedback, setMemoryFeedback] = useState('')

  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'>('idle')
  const [isCallActive, setIsCallActive] = useState(false)
  const [callType, setCallType] = useState<'voice' | 'video'>('voice')
  const [isIncomingCall, setIsIncomingCall] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)

  const isCallerRef = useRef(false)
  const incomingOfferRef = useRef<any>(null)

  const currentUserId = 'family-1'
  const otherUserId = targetId

  const logCallSystemMessage = async (content: string) => {
    if (!conversation) return;
    try {
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'System', // backend might coerce this or store strings
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
        if (isCallerRef.current && callState === 'ringing') {
           // Caller cancelled, nothing or could log cancelled
        }
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
    let cancelled = false

    async function load() {
      try {
        const nextConversation = await getConversationDetail(targetId)
        if (!cancelled) {
          setConversation(nextConversation)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载聊天详情失败')
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
  }, [targetId])

  const messages = conversation?.messages ?? []

  return (
    <section className="screen screen--family-conversation">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">聊天</p>
            <h2>和{conversation?.elderDisplayName ?? '妈妈'}的对话</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="status-pill">会话：{conversation?.elderDisplayName ?? '妈妈'}</span>
            <button onClick={handleInitiateVoiceCall} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="语音通话">📞</button>
            <button onClick={handleInitiateVideoCall} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="视频通话">📹</button>
          </div>
        </div>

        {isCallActive && callType === 'voice' && (
          <VoiceCall
            remoteUser={{ id: otherUserId, name: conversation?.elderDisplayName || '妈妈', avatar: undefined }}
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
            remoteUser={{ id: otherUserId, name: conversation?.elderDisplayName || '妈妈', avatar: undefined }}
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
            title="正在打开这段对话"
            description="稍等一下，我把长辈最近看到和回应过的内容排成完整会话。"
          />
        ) : null}
        {error ? (
          <PageState
            variant="error"
            title="聊天详情暂时没有连上本地服务"
            description={error}
          />
        ) : null}
        {memoryFeedback ? <p className="state-note">{memoryFeedback}</p> : null}

        <div className="message-list">
          {!loading && !error && messages.length === 0 ? (
            <PageState
              title="这一段会话还没有内容"
              description="你现在发出去的第一条问候，会成为这里的第一段家书。"
            />
          ) : null}

          {messages.map((message) => (
            <article
              key={message.id}
              className={`message-bubble message-bubble--${message.senderType === 'Family' ? 'self' : 'peer'}`}
            >
              <span className="message-bubble__sender">{getSenderLabel(message, conversation)}</span>
              {message.messageType === 'Image' ? (
                <div className="message-media">
                  <span>{message.mediaUrl ?? '图片内容'}</span>
                </div>
              ) : null}
              <p>{message.textContent ?? message.transcript ?? '发来一段语音'}</p>
              <footer className="message-bubble__footer">
                <span>{formatClock(message.createdAt)}</span>
                <button
                  className="text-action"
                  type="button"
                  disabled={savingMemoryId === message.id}
                  onClick={() => void handleAddMemory(message)}
                >
                  {savingMemoryId === message.id ? '保存中…' : '✨ 加入回忆'}
                </button>
                {message.aiDrafted ? <span className="status-pill">长辈口述，AI 代发</span> : null}
              </footer>
            </article>
          ))}
        </div>

        <form className="composer-card" onSubmit={handleSubmit}>
          <input
            aria-label="输入消息"
            placeholder="输入文字..."
            value={composerText}
            onChange={(event) => setComposerText(event.target.value)}
          />
          <div className="inline-actions">
            <button className="ghost-action" type="button">
              🎤
            </button>
            <button className="ghost-action" type="button">
              🖼️
            </button>
            <button className="primary-action" type="submit" disabled={sending || !composerText.trim()}>
              {sending ? '发送中…' : '发送'}
            </button>
          </div>
        </form>
      </section>
    </section>
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!conversation || !composerText.trim()) {
      return
    }

    try {
      setSending(true)
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'Family',
        senderMemberId: conversation.memberId,
        messageType: 'Text',
        textContent: composerText.trim(),
        aiDrafted: false,
        isLowInformation: isLowInformation(composerText),
      })
      setConversation(nextConversation)
      setComposerText('')
      setError('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '发送消息失败')
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
        addedByMemberId: 'member_daughter',
        memoryType: toMemoryType(message.messageType),
        title: buildMemoryTitle(conversation.elderDisplayName, message),
        description: buildMemoryDescription(message),
        mediaUrl: message.mediaUrl,
      })
      setMemoryFeedback('这条内容已经加入回忆时间线。')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '加入回忆失败')
    } finally {
      setSavingMemoryId(null)
    }
  }
}

function getSenderLabel(message: Message, conversation: ConversationDetail | null) {
  if (message.senderType === 'Family') {
    return conversation?.familyDisplayName ?? '家人'
  }

  return conversation?.elderDisplayName ?? '妈妈'
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

function buildMemoryTitle(elderName: string, message: Message) {
  if (message.messageType === 'Image') {
    return `${elderName}看到的一张照片`
  }

  if (message.messageType === 'Voice') {
    return `${elderName}收到的一段语音`
  }

  return `${elderName}的一句家人来信`
}

function buildMemoryDescription(message: Message) {
  return message.textContent ?? message.transcript ?? '一段值得留住的内容'
}
