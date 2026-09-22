import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { createMemoryEntry, getConversationDetail, sendMessage } from '../../services/api'
import type { ConversationDetail, Message } from '../../services/api'
import type { ICallSignal } from '../../services/api/types'
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
  const [draftText, setDraftText] = useState(prefillDraft || 'How are you today?')
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
  const incomingOfferRef = useRef<string | null>(null)

  const currentUserId = 'elder-1'
  const otherUserId = conversationId

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
      } else if (signal.type === 'hangup') {
        webrtcManager.hangup()
        setIsCallActive(false)
        setCallState('ended')
        setTimeout(() => setCallState('idle'), 500)
      }
    })

    const unsubscribeConnected = webrtcManager.on('connection-state-changed', (data) => {
      if (isConnectionPayload(data) && data.state === 'connected') {
        setCallState('connected')
      }
    })

    const unsubscribeEnded = webrtcManager.on('call-ended', (data) => {
      setCallState('ended')
      setIsCallActive(false)
      setCallDuration(0)
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
  }

  const handleHangupCall = () => {
    webrtcManager.hangup()
    setIsCallActive(false)
    setCallState('ended')
  }

  const handleInitiateVoiceCall = async () => {
    isCallerRef.current = true
    setIsCallActive(true)
    setCallType('voice')
    setCallState('ringing')
    setIsIncomingCall(false)
    await webrtcManager.initiateCall(currentUserId, otherUserId, 'voice')
  }

  const handleInitiateVideoCall = async () => {
    isCallerRef.current = true
    setIsCallActive(true)
    setCallType('video')
    setCallState('ringing')
    setIsIncomingCall(false)
    await webrtcManager.initiateCall(currentUserId, otherUserId, 'video')
  }

  const messages = conversation?.messages ?? []

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
            remoteUser={{ id: otherUserId, name: conversation?.name || 'Family', avatar: conversation?.avatar }}
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
            remoteUser={{ id: otherUserId, name: conversation?.name || 'Family', avatar: conversation?.avatar }}
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

        {loading ? <PageState title="Loading conversation" description="Please wait..." /> : null}
        {error ? <PageState variant="error" title="Conversation unavailable" description={error} /> : null}
        {voiceResult ? <p className="state-note">{voiceResult.promptTitle}</p> : null}
        {memoryFeedback ? <p className="state-note">{memoryFeedback}</p> : null}

        <div className="message-list">
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
            <div className="inline-actions">
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
        senderMemberId: 'member_elder',
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
        familySpaceId: 'fs_demo',
        sourceConvId: conversation.id,
        sourceMsgId: message.id,
        addedByMemberId: 'member_elder',
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
        familySpaceId: 'fs_demo',
        sourceConvId: conversation?.id ?? null,
        sourceMsgId: null,
        addedByMemberId: 'member_elder',
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
