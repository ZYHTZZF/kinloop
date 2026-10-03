import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { createMemoryEntry, getConversationDetail, getCurrentFamilySpace, getWebSocketUrl, sendMessage } from '../../services/api'
import type { ConversationDetail, Message } from '../../services/api'
import type { ICallSignal } from '../../services/api/types'
import { formatClock } from '../../utils/dateTime'
import { ensureChatImageFile, readFileAsDataUrl } from '../../utils/chatImage'
import {
  ensureChatVideoFile,
  getPlayableVideoUrl,
} from '../../utils/chatImage'
import {
  cancelVoiceRecording,
  formatVoiceDuration,
  formatVoiceDurationMs,
  getPlayableVoiceUrl,
  readVoiceBlobAsDataUrl,
  startVoiceRecording,
  stopVoiceRecording,
  type VoiceRecordingSession,
} from '../../utils/chatVoice'
import type { ElderVoiceIntentResult } from '../../domain/elderVoice'
import { webrtcManager } from '../../services/webrtc/WebRTCManager'
import * as chatApi from '../../services/api/chatApi'
import VoiceCall from '../../components/chat/VoiceCall'
import VideoCall from '../../components/chat/VideoCall'

const STATIC_EMOJIS = ['😀', '😁', '😂', '😃', '😉', '😏', '😝', '🙂', '😊', '😶', '😨', '👍', '🙏', '❤️', '🎉']

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
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false)
  const [sending, setSending] = useState(false)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [voiceDurationMs, setVoiceDurationMs] = useState(0)
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
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const voiceSessionRef = useRef<VoiceRecordingSession | null>(null)
  const voiceTimerRef = useRef<number>(0)

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

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current)
      }

      if (voiceSessionRef.current) {
        cancelVoiceRecording(voiceSessionRef.current)
      }
    }
  }, [])

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
                <button onClick={() => void handleInitiateVoiceCall()} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="Voice call">{'\u{1F4DE}'}</button>
                <button onClick={() => void handleInitiateVideoCall()} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="Video call">{'\u{1F4F9}'}</button>
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
            <div
              key={message.id}
              className={`message-thread message-thread--${message.senderType === 'Elder' ? 'self' : 'peer'}`}
            >
              <article
                className={`message-bubble message-bubble--${message.senderType === 'Family' ? 'family' : 'elder'}`}
              >
                <span className="message-bubble__sender">{getSenderLabel(message, conversation?.name ?? 'Family')}</span>
                {message.messageType === 'Image' ? (
                  <div className="message-media">
                    {message.mediaUrl ? (
                      <img className="message-media__image" src={message.mediaUrl} alt="聊天图片" />
                    ) : (
                      <span>图片加载失败</span>
                    )}
                  </div>
                ) : null}
                {message.messageType === 'Video' ? (
                  <div className="message-video">
                    {getPlayableVideoUrl(message.mediaUrl) ? (
                      <video
                        className="message-video__player"
                        controls
                        preload="metadata"
                        src={getPlayableVideoUrl(message.mediaUrl) ?? undefined}
                      />
                    ) : (
                      <div className="message-voice__fallback">这条视频暂时无法播放</div>
                    )}
                  </div>
                ) : null}
                {message.messageType === 'Voice' ? (
                  <div className="message-voice">
                    {getPlayableVoiceUrl(message.mediaUrl) ? (
                      <audio
                        className="message-voice__player"
                        controls
                        preload="metadata"
                        src={getPlayableVoiceUrl(message.mediaUrl) ?? undefined}
                      />
                    ) : (
                      <div className="message-voice__fallback">这条语音暂时无法播放</div>
                    )}
                    <div className="message-voice__meta">
                      <span>{formatVoiceDuration(message.voiceDurationSec)}</span>
                      {message.transcript ? <span>{message.transcript}</span> : null}
                    </div>
                  </div>
                ) : null}
                {(message.messageType !== 'Image' && message.messageType !== 'Voice' && message.messageType !== 'Video') || message.textContent ? (
                  <p>{message.textContent ?? message.transcript ?? 'Voice message'}</p>
                ) : null}
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
            </div>
          ))}
        </div>

        {conversation ? (
          <form
            className={`ai-confirm-card ${isDraggingImage ? 'composer-card--dragging' : ''}`}
            onSubmit={handleSubmitReply}
            onDragOver={handleComposerDragOver}
            onDragLeave={handleComposerDragLeave}
            onDrop={handleComposerDrop}
          >
            <p className="surface-card__eyebrow">AI draft confirm</p>
            <strong>Send to {conversation.name}:</strong>
            <div className="composer-input-row">
              <input
                aria-label="AI draft"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
              />
              <button
                className="ghost-action composer-plus-button"
                type="button"
                onClick={() => setShowAttachmentOptions((prev) => !prev)}
                disabled={sending || isRecordingVoice}
                aria-label="选择附件"
                title="发送图片或视频"
              >
                +
              </button>
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleSelectImage}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={handleSelectVideo}
            />
            {showAttachmentOptions ? (
              <div className="attachment-menu">
                <button
                  className="ghost-action attachment-menu__button"
                  type="button"
                  disabled={sending || isRecordingVoice}
                  onClick={() => {
                    setShowAttachmentOptions(false)
                    imageInputRef.current?.click()
                  }}
                >
                  图片
                </button>
                <button
                  className="ghost-action attachment-menu__button"
                  type="button"
                  disabled={sending || isRecordingVoice}
                  onClick={() => {
                    setShowAttachmentOptions(false)
                    videoInputRef.current?.click()
                  }}
                >
                  视频
                </button>
              </div>
            ) : null}
            {isDraggingImage ? <p className="composer-drop-tip">松手后直接发送图片或视频</p> : null}
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
                {'\u{1F600}'}
              </button>
              <button
                className="ghost-action"
                type="button"
                disabled={savingAiMemory || !draftText.trim()}
                onClick={() => void handleAddAiMemory()}
              >
                {savingAiMemory ? 'Saving...' : 'Save as memory'}
              </button>
              <button className="primary-action" type="submit" disabled={sending || isRecordingVoice || !draftText.trim()}>
                {sending ? 'Sending...' : 'Send'}
              </button>
              <button
                className={`ghost-action voice-action ${isRecordingVoice ? 'voice-action--recording' : ''}`}
                type="button"
                disabled={sending}
                onClick={() => void handleToggleVoiceRecording()}
              >
                {isRecordingVoice ? formatVoiceDurationMs(voiceDurationMs) : '语音'}
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

  async function handleToggleVoiceRecording() {
    if (isRecordingVoice) {
      await handleStopVoiceRecording()
      return
    }

    try {
      setError('')
      const session = await startVoiceRecording()
      voiceSessionRef.current = session
      setIsRecordingVoice(true)
      setVoiceDurationMs(0)
      voiceTimerRef.current = window.setInterval(() => {
        setVoiceDurationMs(Date.now() - session.startedAt)
      }, 200)
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : '无法开始录音')
    }
  }

  async function handleStopVoiceRecording() {
    const session = voiceSessionRef.current
    if (!session || !conversation) {
      return
    }

    try {
      setSending(true)
      setError('')
      const { blob, durationMs } = await stopVoiceRecording(session)
      const mediaUrl = await readVoiceBlobAsDataUrl(blob)
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'Elder',
        senderMemberId: conversation.elderMemberId,
        messageType: 'Voice',
        textContent: null,
        mediaUrl,
        voiceDurationSec: Math.max(1, Math.round(durationMs / 1000)),
        transcript: null,
        transcriptConfidence: null,
        aiDrafted: false,
        isLowInformation: false,
      })
      setConversation(nextConversation)
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : '发送语音失败')
    } finally {
      voiceSessionRef.current = null
      setIsRecordingVoice(false)
      setVoiceDurationMs(0)
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current)
      }
      setSending(false)
    }
  }

  async function handleSendImage(file: File) {
    if (!conversation) {
      return
    }

    try {
      setSending(true)
      setError('')
      const imageFile = ensureChatImageFile(file)
      const mediaUrl = await readFileAsDataUrl(imageFile)
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'Elder',
        senderMemberId: conversation.elderMemberId,
        messageType: 'Image',
        textContent: null,
        mediaUrl,
        aiDrafted: false,
        isLowInformation: false,
      })
      setConversation(nextConversation)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '发送图片失败')
    } finally {
      setSending(false)
      setIsDraggingImage(false)
      setShowAttachmentOptions(false)
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
    }
  }

  async function handleSendVideo(file: File) {
    if (!conversation) {
      return
    }

    try {
      setSending(true)
      setError('')
      const videoFile = ensureChatVideoFile(file)
      const mediaUrl = await readFileAsDataUrl(videoFile)
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'Elder',
        senderMemberId: conversation.elderMemberId,
        messageType: 'Video',
        textContent: null,
        mediaUrl,
        aiDrafted: false,
        isLowInformation: false,
      })
      setConversation(nextConversation)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '发送视频失败')
    } finally {
      setSending(false)
      setIsDraggingImage(false)
      setShowAttachmentOptions(false)
      if (videoInputRef.current) {
        videoInputRef.current.value = ''
      }
    }
  }

  function handleSelectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      void handleSendImage(file)
    }
  }

  function handleSelectVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      void handleSendVideo(file)
    }
  }

  function handleComposerDragOver(event: DragEvent<HTMLFormElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDraggingImage(true)
  }

  function handleComposerDragLeave(event: DragEvent<HTMLFormElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setIsDraggingImage(false)
  }

  function handleComposerDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsDraggingImage(false)

    const file = Array.from(event.dataTransfer.files).find(
      (item) => item.type.startsWith('image/') || item.type.startsWith('video/'),
    )
    if (!file) {
      setError('请拖入图片或视频文件')
      return
    }

    if (file.type.startsWith('video/')) {
      void handleSendVideo(file)
      return
    }

    void handleSendImage(file)
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

