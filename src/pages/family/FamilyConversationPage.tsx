import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { createMemoryEntry, getConversationDetail, sendMessage } from '../../services/api'
import type { ConversationDetail, Message } from '../../services/api'
import type { ICallSignal } from '../../services/api/types'
import { formatClock } from '../../utils/dateTime'
import { webrtcManager } from '../../services/webrtc/WebRTCManager'
import * as chatApi from '../../services/api/chatApi'
import VoiceCall from '../../components/chat/VoiceCall'
import VideoCall from '../../components/chat/VideoCall'

const STATIC_EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🥳', '😭', '😡', '👍', '👏', '🙏', '❤️', '🎉']

export function FamilyConversationPage() {
  const { conversationId = 'daughter', userId } = useParams()
  const targetId = userId || conversationId
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
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

  const currentUserId = 'family-1'
  const otherUserId = targetId

  const syncConversation = async () => {
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
        senderMemberId: conversation.memberId,
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
        senderMemberId: conversation.memberId,
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
    const initWS = async () => {
      if (!chatApi.isWebSocketConnected()) {
        try {
          await chatApi.initWebSocket('ws://localhost:3001', currentUserId)
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
    }
  }, [callState, conversation, currentUserId, otherUserId])

  const handleAcceptCall = async () => {
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
    await webrtcManager.rejectCall(currentUserId, otherUserId, 'call-id')
    setIsCallActive(false)
    setCallState('idle')
    setLocalCallStream(null)
    setRemoteCallStream(null)
  }

  const handleHangupCall = () => {
    webrtcManager.hangup()
    setIsCallActive(false)
    setCallState('ended')
    setLocalCallStream(null)
    setRemoteCallStream(null)
  }

  const handleInitiateVoiceCall = async () => {
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
        const nextConversation = await getConversationDetail(targetId)
        if (!cancelled) {
          setConversation(nextConversation)
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
            remoteUser={{ id: otherUserId, name: conversation?.elderDisplayName || 'Family member', avatar: undefined }}
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
            remoteUser={{ id: otherUserId, name: conversation?.elderDisplayName || 'Family member', avatar: undefined }}
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
            onToggleMute={(m) => setIsMuted(m)}
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
            <article
              key={message.id}
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
        familySpaceId: 'fs_demo',
        sourceConvId: conversation.id,
        sourceMsgId: message.id,
        addedByMemberId: 'member_daughter',
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
