import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { createMemoryEntry, getConversationDetail, getCurrentFamilySpace, getWebSocketUrl, sendMessage } from '../../services/api'
import type { ConversationDetail, Message } from '../../services/api'
import type { ICallSignal } from '../../services/api/types'
import { formatClock } from '../../utils/dateTime'
import { webrtcManager } from '../../services/webrtc/WebRTCManager'
import * as chatApi from '../../services/api/chatApi'
import VoiceCall from '../../components/chat/VoiceCall'
import VideoCall from '../../components/chat/VideoCall'

const STATIC_EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🥳', '😭', '😡', '👍', '👏', '🙏', '❤️', '🎉']

export function FamilyConversationPage() {
  const { conversationId, userId } = useParams()
  const targetId = userId || conversationId || ''
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [familySpaceId, setFamilySpaceId] = useState('fs_demo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerText, setComposerText] = useState('')
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
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
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null)
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null)

  const isCallerRef = useRef(false)
  const incomingOfferRef = useRef<string | null>(null)

  const currentUserId = conversation?.familyMemberId ?? null
  const otherUserId = conversation?.elderMemberId ?? null

  const syncConversation = async () => {
    if (!targetId) return
    try {
      const nextConversation = await getConversationDetail(targetId)
      setConversation(nextConversation)
    } catch (err) {
      console.error('Failed to sync conversation', err)
    }
  }

  const sendOutgoingCallMessage = async (type: 'voice' | 'video') => {
    if (!conversation) return

    try {
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'Family',
        senderMemberId: conversation.familyMemberId,
        messageType: 'Text',
        textContent: type === 'video' ? '发起了视频通话' : '发起了语音通话',
        aiDrafted: false,
        isLowInformation: false,
      })
      setConversation(nextConversation)
    } catch (err) {
      console.error('Failed to send call message', err)
    }
  }

  const logCallSystemMessage = async (content: string) => {
    if (!conversation) return
    try {
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'System',
        senderMemberId: conversation.familyMemberId,
        messageType: 'Text',
        textContent: content,
        aiDrafted: false,
        isLowInformation: false,
      })
      setConversation(nextConversation)
    } catch (err) {
      console.error('Failed to log system message', err)
    }
  }

  useEffect(() => {
    if (!conversation || !currentUserId || !otherUserId) {
      return
    }

    const initWS = async () => {
      if (!chatApi.isWebSocketConnected()) {
        try {
          await chatApi.initWebSocket(getWebSocketUrl(), currentUserId)
        } catch (e) {
          console.error(e)
        }
      }
    }
    void initWS()

    webrtcManager.setSignalingClient(async (signal) => {
      chatApi.sendWebrtcSignal({ ...signal, to: otherUserId, from: currentUserId })
    })

    chatApi.setWebrtcSignalHandler(async (signal: ICallSignal) => {
      if (signal.type === 'offer') {
        const sdp = getSignalSdp(signal)
        if (!sdp) return
        isCallerRef.current = false
        incomingOfferRef.current = sdp
        setIsCallActive(true)
        setCallType(signal.callType || 'voice')
        setCallState('ringing')
        setIsIncomingCall(true)
        setTimeout(() => {
          void syncConversation()
        }, 120)
      } else if (signal.type === 'answer') {
        const sdp = getSignalSdp(signal)
        if (!sdp) return
        await webrtcManager.handleAnswer({ type: 'answer', sdp } as RTCSessionDescription)
      } else if (signal.type === 'ice-candidate') {
        const candidate = getSignalIceCandidate(signal)
        if (!candidate) return
        await webrtcManager.handleIceCandidate(candidate)
      } else if (signal.type === 'reject') {
        if (isCallerRef.current) {
          void logCallSystemMessage('Voice call rejected by remote user')
        }
        setIsCallActive(false)
        setCallState('idle')
        setLocalCallStream(null)
        setRemoteCallStream(null)
      } else if (signal.type === 'hangup') {
        webrtcManager.hangup()
        setIsCallActive(false)
        setCallState('ended')
        setLocalCallStream(null)
        setRemoteCallStream(null)
        setTimeout(() => setCallState('idle'), 500)
      }
    })

    chatApi.setConversationUpdateHandler(async (payload) => {
      if (payload.conversationId !== conversation.id) return
      await syncConversation()
    })

    const unsubscribeConnected = webrtcManager.on('connection-state-changed', (data) => {
      if (isConnectionPayload(data) && data.state === 'connected') {
        setCallState('connected')
        setLocalCallStream(webrtcManager.getLocalStream())
        setRemoteCallStream(webrtcManager.getRemoteStream())
      }
    })

    const unsubscribeEnded = webrtcManager.on('call-ended', (data) => {
      setCallState('ended')
      setIsCallActive(false)
      setCallDuration(0)
      setLocalCallStream(null)
      setRemoteCallStream(null)
      setTimeout(() => setCallState('idle'), 500)

      if (isCallerRef.current && isCallEndedPayload(data) && typeof data.duration === 'number' && callState === 'connected') {
        const durationSecs = Math.round(data.duration / 1000)
        void logCallSystemMessage(`Voice call ended, duration: ${durationSecs}s`)
      }
    })

    return () => {
      unsubscribeConnected()
      unsubscribeEnded()
      chatApi.setConversationUpdateHandler(null)
      chatApi.setWebrtcSignalHandler(null)
    }
  }, [callState, conversation, currentUserId, otherUserId])

  const handleAcceptCall = async () => {
    if (!currentUserId || !otherUserId) return
    try {
      setCallState('connecting')
      if (incomingOfferRef.current) {
        await webrtcManager.acceptCall(
          currentUserId,
          { type: 'offer', sdp: incomingOfferRef.current } as RTCSessionDescription,
          otherUserId,
          callType,
          `${otherUserId}-${currentUserId}`,
        )
        if (callType === 'video') {
          setIsCameraOn(true)
          webrtcManager.toggleVideo(true)
        }
        setLocalCallStream(webrtcManager.getLocalStream())
        setRemoteCallStream(webrtcManager.getRemoteStream())
      }
    } catch (e) {
      console.error(e)
      setIsCallActive(false)
      setCallState('idle')
    }
  }

  const handleRejectCall = async () => {
    if (!currentUserId || !otherUserId) return
    await webrtcManager.rejectCall(currentUserId, otherUserId, 'call-id')
    setIsCallActive(false)
    setCallState('idle')
    setLocalCallStream(null)
    setRemoteCallStream(null)
  }

  const handleHangupCall = () => {
    if (!currentUserId || !otherUserId) return
    chatApi.sendWebrtcSignal({
      type: 'hangup',
      from: currentUserId,
      to: otherUserId,
      callId: `${currentUserId}-${otherUserId}`,
      timestamp: Date.now(),
    })
    webrtcManager.hangup()
    setIsCallActive(false)
    setCallState('ended')
    setLocalCallStream(null)
    setRemoteCallStream(null)
  }

  const handleInitiateVoiceCall = async () => {
    if (!currentUserId || !otherUserId) return
    isCallerRef.current = true
    setIsCallActive(true)
    setCallType('voice')
    setCallState('ringing')
    setIsIncomingCall(false)
    await webrtcManager.initiateCall(currentUserId, otherUserId, 'voice')
    await sendOutgoingCallMessage('voice')
    setLocalCallStream(webrtcManager.getLocalStream())
    setRemoteCallStream(webrtcManager.getRemoteStream())
  }

  const handleInitiateVideoCall = async () => {
    if (!currentUserId || !otherUserId) return
    isCallerRef.current = true
    setIsCallActive(true)
    setCallType('video')
    setCallState('ringing')
    setIsIncomingCall(false)
    await webrtcManager.initiateCall(currentUserId, otherUserId, 'video')
    await sendOutgoingCallMessage('video')
    setIsCameraOn(true)
    webrtcManager.toggleVideo(true)
    setLocalCallStream(webrtcManager.getLocalStream())
    setRemoteCallStream(webrtcManager.getRemoteStream())
  }

  const handleToggleCamera = (enabled: boolean) => {
    setIsCameraOn(enabled)
    webrtcManager.toggleVideo(enabled)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        if (!targetId) {
          throw new Error('Conversation id is missing')
        }
        const [nextConversation, familySpace] = await Promise.all([
          getConversationDetail(targetId),
          getCurrentFamilySpace(),
        ])
        if (!cancelled) {
          setConversation(nextConversation)
          setFamilySpaceId(familySpace.id)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load conversation')
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
            <Link className="back-link" to="/family/chats">
              返回聊天列表
            </Link>
            <p className="surface-card__eyebrow">Chat</p>
            <h2>Conversation with {conversation?.elderDisplayName ?? 'Family member'}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => void handleInitiateVoiceCall()} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="Voice call">📓</button>
            <button onClick={() => void handleInitiateVideoCall()} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="Video call">📴</button>
          </div>
        </div>

        {isCallActive && callType === 'voice' && (
          <VoiceCall
            remoteUser={{ id: otherUserId ?? '', name: conversation?.elderDisplayName || 'Family member', avatar: undefined }}
            callState={callState}
            duration={callDuration}
            isIncoming={isIncomingCall}
            isMuted={isMuted}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
            onHangup={handleHangupCall}
            onToggleMute={(m) => {
              setIsMuted(m)
              webrtcManager.toggleAudio(!m)
            }}
          />
        )}

        {isCallActive && callType === 'video' && (
          <VideoCall
            remoteUser={{ id: otherUserId ?? '', name: conversation?.elderDisplayName || 'Family member', avatar: undefined }}
            remoteStream={remoteCallStream}
            localStream={localCallStream}
            callState={callState}
            duration={callDuration}
            isIncoming={isIncomingCall}
            isMuted={isMuted}
            isCameraOn={isCameraOn}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
            onHangup={handleHangupCall}
            onToggleMute={(m) => {
              setIsMuted(m)
              webrtcManager.toggleAudio(!m)
            }}
            onToggleCamera={handleToggleCamera}
          />
        )}

        {loading ? <PageState title="Loading conversation" description="Please wait..." /> : null}
        {error ? <PageState variant="error" title="Conversation unavailable" description={error} /> : null}
        {memoryFeedback ? <p className="state-note">{memoryFeedback}</p> : null}

        <div className="message-list">
          {!loading && !error && messages.length === 0 ? (
            <PageState title="No messages yet" description="Send your first message to start this conversation." />
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`message-thread message-thread--${message.senderType === 'Family' ? 'self' : 'peer'}`}
            >
              <article
                className={`message-bubble message-bubble--${message.senderType === 'Family' ? 'self' : 'peer'}`}
              >
                <span className="message-bubble__sender">{getSenderLabel(message, conversation)}</span>
                {message.messageType === 'Image' ? (
                  <div className="message-media">
                    <span>{message.mediaUrl ?? 'Image content'}</span>
                  </div>
                ) : null}
                <p>{message.textContent ?? message.transcript ?? 'Voice message'}</p>
                <footer className="message-bubble__footer">
                  <span>{formatClock(message.createdAt)}</span>
                  <button
                    className="text-action"
                    type="button"
                    disabled={savingMemoryId === message.id}
                    onClick={() => void handleAddMemory(message)}
                  >
                    {savingMemoryId === message.id ? 'Saving...' : 'Add to memories'}
                  </button>
                  {message.aiDrafted ? <span className="status-pill">AI drafted</span> : null}
                </footer>
              </article>

              {message.senderType === 'Elder' && message.emotion ? (
                <div className={`message-emotion-chip message-emotion-chip--${toSeverityTone(message.emotion.severity)}`}>
                  <span>{getEmotionSourceLabel(message.emotion.source)}</span>
                  <strong>{formatEmotionSummary(message.emotion.summary)}</strong>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {showEmojiPanel ? (
          <div className="composer-card" style={{ marginBottom: '10px' }}>
            <p className="surface-card__eyebrow">静态表情</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '8px' }}>
              {STATIC_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="ghost-action"
                  style={{ fontSize: '20px', padding: '6px 0' }}
                  onClick={() => handlePickEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form className="composer-card" onSubmit={handleSubmit}>
          <input
            aria-label="Input message"
            placeholder="Type a message..."
            value={composerText}
            onChange={(event) => setComposerText(event.target.value)}
          />
          <div className="inline-actions">
            <button className="ghost-action" type="button" onClick={() => setShowEmojiPanel((prev) => !prev)}>
              😀
            </button>
            <button className="primary-action" type="submit" disabled={sending || !composerText.trim()}>
              {sending ? 'Sending...' : 'Send'}
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
        senderMemberId: conversation.familyMemberId,
        messageType: 'Text',
        textContent: composerText.trim(),
        aiDrafted: false,
        isLowInformation: isLowInformation(composerText),
      })
      setConversation(nextConversation)
      setComposerText('')
      setError('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to send message')
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
        familySpaceId,
        sourceConvId: conversation.id,
        sourceMsgId: message.id,
        addedByMemberId: currentUserId ?? conversation.familyMemberId,
        memoryType: toMemoryType(message.messageType),
        title: buildMemoryTitle(conversation.elderDisplayName, message),
        description: buildMemoryDescription(message),
        mediaUrl: message.mediaUrl,
      })
      setMemoryFeedback('Saved to memories')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save memory')
    } finally {
      setSavingMemoryId(null)
    }
  }

  function handlePickEmoji(emoji: string) {
    setComposerText((prev) => `${prev}${emoji}`)
  }
}

function getSignalSdp(signal: ICallSignal): string | null {
  const sdp = signal.data?.sdp
  return typeof sdp === 'string' ? sdp : null
}

function getSignalIceCandidate(signal: ICallSignal): RTCIceCandidate | null {
  const data = signal.data
  if (!data) return null

  const candidate = data.candidate
  const sdpMid = data.sdpMid
  const sdpMLineIndex = data.sdpMLineIndex

  if (typeof candidate !== 'string') return null

  return new RTCIceCandidate({
    candidate,
    sdpMid: typeof sdpMid === 'string' ? sdpMid : null,
    sdpMLineIndex: typeof sdpMLineIndex === 'number' ? sdpMLineIndex : null,
  })
}

function isConnectionPayload(data: unknown): data is { state?: string } {
  return typeof data === 'object' && data !== null
}

function isCallEndedPayload(data: unknown): data is { duration?: number } {
  return typeof data === 'object' && data !== null
}

function getSenderLabel(message: Message, conversation: ConversationDetail | null) {
  if (message.senderType === 'Family') {
    return conversation?.familyDisplayName ?? 'Family'
  }

  return conversation?.elderDisplayName ?? 'Elder'
}

function isLowInformation(input: string) {
  const normalized = input.trim().toLowerCase()
  return ['ok', 'yes', 'received', 'got it'].includes(normalized)
}

function toMemoryType(messageType: string) {
  if (messageType === 'Image') return 'Image'
  if (messageType === 'Voice') return 'Voice'
  return 'Text'
}

function buildMemoryTitle(elderName: string, message: Message) {
  if (message.messageType === 'Image') {
    return `${elderName} image message`
  }

  if (message.messageType === 'Voice') {
    return `${elderName} voice message`
  }

  return `${elderName} text message`
}

function buildMemoryDescription(message: Message) {
  return message.textContent ?? message.transcript ?? 'A meaningful message'
}

function toSeverityTone(severity: string) {
  if (severity === 'HIGH') return 'high'
  if (severity === 'MEDIUM') return 'medium'
  return 'low'
}

function getEmotionSourceLabel(source: string | null | undefined) {
  if (source === 'voice_tone') return '语气情绪'
  if (source === 'text_fallback') return '转写文本情绪'
  if (source === 'text') return '文本情绪'
  if (source === 'face') return '表情情绪'
  return '情绪识别'
}

function formatEmotionSummary(summary: string) {
  return summary
    .replace('fallback:neutral', '平稳')
    .replace('fallback:angry', '生气')
    .replace('fallback:sad', '难过')
    .replace('fallback:anxious', '焦虑')
    .replace('fallback:negative', '消极')
    .replace('fallback:positive', '积极')
    .replace('：neutral', '：平稳')
    .replace('：angry', '：生气')
    .replace('：sad', '：难过')
    .replace('：anxious', '：焦虑')
    .replace('：negative', '：消极')
    .replace('：positive', '：积极')
    .replace('：calm', '：平静')
}
