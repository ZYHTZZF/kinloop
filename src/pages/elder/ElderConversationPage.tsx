import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { createMemoryEntry, getConversationDetail, getCurrentFamilySpace, getWebSocketUrl, sendMessage } from '../../services/api'
import type { ConversationDetail, Message } from '../../services/api'
import type { ICallSignal } from '../../services/api/types'
import { formatClock } from '../../utils/dateTime'
import type { ElderVoiceIntentResult } from '../../domain/elderVoice'
import { webrtcManager } from '../../services/webrtc/WebRTCManager'
import * as chatApi from '../../services/api/chatApi'
import VoiceCall from '../../components/chat/VoiceCall'
import VideoCall from '../../components/chat/VideoCall'

const STATIC_EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🥳', '😭', '😡', '👍', '👏', '🙏', '❤️', '🎉']

export function ElderConversationPage() {
  const location = useLocation()
  const { conversationId } = useParams()
  const voiceResult = location.state?.elderVoiceResult as ElderVoiceIntentResult | undefined
  const prefillDraft = (location.state?.prefillDraft as string | undefined) ?? ''
  const autoSendMessage = Boolean(location.state?.autoSendMessage)

  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [familySpaceId, setFamilySpaceId] = useState('fs_demo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftText, setDraftText] = useState(prefillDraft || '')
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
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
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null)
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null)

  const isCallerRef = useRef(false)
  const incomingOfferRef = useRef<string | null>(null)
  const autoSendOnceRef = useRef(false)
  const messageListRef = useRef<HTMLDivElement | null>(null)

  const currentUserId = conversation?.elderMemberId ?? null
  const otherUserId = conversation?.familyMemberId ?? null

  const syncConversation = async () => {
    if (!conversationId) return
    try {
      const nextConversation = await getConversationDetail(conversationId)
      setConversation(nextConversation)
    } catch (err) {
      console.error('Failed to sync conversation', err)
    }
  }

  const sendOutgoingCallMessage = async (type: 'voice' | 'video') => {
    if (!conversation) return

    try {
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'Elder',
        senderMemberId: conversation.elderMemberId,
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

  useEffect(() => {
    if (prefillDraft) {
      setDraftText(prefillDraft)
    }
  }, [prefillDraft])

  useEffect(() => {
    if (!autoSendMessage || autoSendOnceRef.current) return
    if (!conversation || !draftText.trim()) return

    autoSendOnceRef.current = true
    void (async () => {
      try {
        setSending(true)
        const nextConversation = await sendMessage(conversation.id, {
          senderType: 'Elder',
          senderMemberId: conversation.elderMemberId,
          messageType: 'Text',
          textContent: draftText.trim(),
          aiDrafted: true,
          isLowInformation: isLowInformation(draftText),
        })
        setConversation(nextConversation)
        setError('')
      } catch (submitError) {
        autoSendOnceRef.current = false
        setError(submitError instanceof Error ? submitError.message : '自动发送失败')
      } finally {
        setSending(false)
      }
    })()
  }, [autoSendMessage, conversation, draftText])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        if (!conversationId) {
          throw new Error('Conversation id is missing')
        }
        const [nextConversation, familySpace] = await Promise.all([
          getConversationDetail(conversationId),
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
  }, [conversationId])

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

  const messages = conversation?.messages ?? []

  useEffect(() => {
    const list = messageListRef.current
    if (!list) {
      return
    }

    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight
    })
  }, [messages.length, loading])

  return (
    <section className="screen screen--elder-conversation">
      <section className="surface-card">
        <header className="detail-header">
          <Link className="back-link" to="/elder/inbox">
            Back
          </Link>
          {conversation ? (
            <div className="detail-header__identity" style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="avatar-badge">{conversation.avatar}</span>
                <div>
                  <p className="surface-card__eyebrow">Chatting with</p>
                  <h2>{conversation.name}</h2>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', paddingRight: '16px' }}>
                <button onClick={() => void handleInitiateVoiceCall()} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="Voice call">📓</button>
                <button onClick={() => void handleInitiateVideoCall()} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="Video call">📴</button>
              </div>
            </div>
          ) : null}
        </header>

        {isCallActive && callType === 'voice' && (
          <VoiceCall
            remoteUser={{ id: otherUserId ?? '', name: conversation?.name || 'Family', avatar: conversation?.avatar }}
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
            remoteUser={{ id: otherUserId ?? '', name: conversation?.name || 'Family', avatar: conversation?.avatar }}
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
        {voiceResult ? <p className="state-note">{voiceResult.promptTitle}</p> : null}
        {memoryFeedback ? <p className="state-note">{memoryFeedback}</p> : null}

        <div ref={messageListRef} className="message-list">
          {!loading && !error && messages.length === 0 ? (
            <PageState title="No messages yet" description="Start with a short message." />
          ) : null}

          {messages.map((message) => (
            <article
              key={message.id}
              className={`message-bubble message-bubble--${message.senderType === 'Family' ? 'family' : 'elder'}`}
            >
              <span className="message-bubble__sender">{getSenderLabel(message, conversation?.name ?? 'Family')}</span>
              {message.messageType === 'Image' ? (
                <div className="message-media">
                  <span>{message.mediaUrl ?? 'Image content'}</span>
                </div>
              ) : null}
              <p>{message.textContent ?? message.transcript ?? 'Voice message'}</p>
              <footer className="message-bubble__footer">
                <span>{formatClock(message.createdAt)}</span>
                {message.senderType === 'Family' ? (
                  <button
                    className="text-action"
                    type="button"
                    disabled={savingMemoryId === message.id}
                    onClick={() => void handleAddMemory(message)}
                  >
                    {savingMemoryId === message.id ? 'Saving...' : 'Add to memories'}
                  </button>
                ) : null}
                {message.aiDrafted ? <span className="status-pill">AI drafted</span> : null}
              </footer>
            </article>
          ))}
        </div>

        {conversation ? (
          <form className="ai-confirm-card" onSubmit={handleSubmitReply}>
            <p className="surface-card__eyebrow">AI draft confirm</p>
            <strong>Send to {conversation.name}:</strong>
            <input
              aria-label="AI draft"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
            />
            {showEmojiPanel ? (
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
            ) : null}
            <div className="inline-actions">
              <button className="ghost-action" type="button" onClick={() => setShowEmojiPanel((prev) => !prev)}>
                😀
              </button>
              <button
                className="ghost-action"
                type="button"
                disabled={savingAiMemory || !draftText.trim()}
                onClick={() => void handleAddAiMemory()}
              >
                {savingAiMemory ? 'Saving...' : 'Save as memory'}
              </button>
              <button className="primary-action" type="submit" disabled={sending || !draftText.trim()}>
                {sending ? 'Sending...' : 'Send'}
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
        senderMemberId: conversation.elderMemberId,
        messageType: 'Text',
        textContent: draftText.trim(),
        aiDrafted: true,
        isLowInformation: isLowInformation(draftText),
      })
      setConversation(nextConversation)
      setError('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to send AI draft')
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
        addedByMemberId: currentUserId ?? conversation.elderMemberId,
        memoryType: toMemoryType(message.messageType),
        title: buildFamilyMemoryTitle(conversation.name, message),
        description: message.textContent ?? message.transcript ?? 'A meaningful message',
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

  async function handleAddAiMemory() {
    if (!draftText.trim()) {
      return
    }

    try {
      setSavingAiMemory(true)
      await createMemoryEntry({
        familySpaceId,
        sourceConvId: conversation?.id ?? null,
        sourceMsgId: null,
        addedByMemberId: currentUserId ?? conversation?.elderMemberId ?? 'member_elder',
        memoryType: 'Text',
        title: 'AI draft memory',
        description: draftText.trim(),
        mediaUrl: null,
      })
      setMemoryFeedback('AI draft saved to memories')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save AI memory')
    } finally {
      setSavingAiMemory(false)
    }
  }

  function handlePickEmoji(emoji: string) {
    setDraftText((prev) => `${prev}${emoji}`)
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

function getSenderLabel(message: Message, familyName: string) {
  if (message.senderType === 'Family') {
    return familyName
  }

  return 'Me'
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

function buildFamilyMemoryTitle(familyName: string, message: Message) {
  if (message.messageType === 'Image') {
    return `${familyName} image message`
  }

  if (message.messageType === 'Voice') {
    return `${familyName} voice message`
  }

  return `${familyName} text message`
}
