import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import {
  createMemoryEntry,
  explainGenerationBridge,
  getConversationDetail,
  getCurrentFamilySpace,
  markConversationRead,
  getPreSendSuggestion,
  getUnreadSummary,
  getWebSocketUrl,
  sendMessage,
} from '../../services/api'
import type { ConversationDetail, GenerationBridgeExplainResponse, Message, PreSendSuggestion, UnreadSummaryResponse } from '../../services/api'
import type { ICallSignal } from '../../services/api/types'
import { formatClock } from '../../utils/dateTime'
import {
  ensureChatImageFile,
  ensureChatVideoFile,
  getPlayableVideoUrl,
  readFileAsDataUrl,
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
import { webrtcManager } from '../../services/webrtc/WebRTCManager'
import * as chatApi from '../../services/api/chatApi'
import VoiceCall from '../../components/chat/VoiceCall'
import VideoCall from '../../components/chat/VideoCall'
import { buildPreSendSuggestion } from '../../domain/content/preSendSuggestions'

const STATIC_EMOJIS = ['😀', '😁', '😂', '😃', '😉', '😏', '😝', '🙂', '😊', '😶', '😨', '👍', '🙏', '❤️', '🎉']

type GenerationBridgeViewState = {
  isOpen: boolean
  loading: boolean
  error: string | null
  result: GenerationBridgeExplainResponse | null
}

type UnreadSummaryViewState = {
  isOpen: boolean
  loading: boolean
  error: string | null
  result: UnreadSummaryResponse | null
}

import { MessageAuxArea } from '../../components/chat/MessageAuxArea'

export function FamilyConversationPage() {
  const { conversationId, userId } = useParams()
  const targetId = userId || conversationId || ''
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [familySpaceId, setFamilySpaceId] = useState('fs_demo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerText, setComposerText] = useState('')
  const [showEmojiPanel, setShowEmojiPanel] = useState(false)
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false)
  const [sending, setSending] = useState(false)
  const [isDraggingMedia, setIsDraggingMedia] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [voiceDurationMs, setVoiceDurationMs] = useState(0)
  const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null)
  const [memoryFeedback, setMemoryFeedback] = useState('')
  const [readFeedback, setReadFeedback] = useState('')
  const [generationBridgeByMessageId, setGenerationBridgeByMessageId] = useState<Record<string, GenerationBridgeViewState>>({})
  const [preSendSuggestion, setPreSendSuggestion] = useState<PreSendSuggestion | null>(null)
  const [postSendFollowupSuggestion, setPostSendFollowupSuggestion] = useState<PreSendSuggestion | null>(null)
  const [dismissedSuggestionKey, setDismissedSuggestionKey] = useState<string | null>(null)
  const [markingRead, setMarkingRead] = useState(false)
  const [unreadSummaryState, setUnreadSummaryState] = useState<UnreadSummaryViewState>({
    isOpen: false,
    loading: false,
    error: null,
    result: null,
  })

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
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const voiceSessionRef = useRef<VoiceRecordingSession | null>(null)
  const voiceTimerRef = useRef<number>(0)
  const preSendRequestRef = useRef(0)

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
  const unreadCount = messages.filter((message) => (
    message.senderType === 'Elder'
    && !message.consumedAt
    && !message.recalledAt
  )).length

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

  useEffect(() => {
    const trimmedDraft = composerText.trim()

    if (!trimmedDraft || !conversation || isRecordingVoice) {
      setPreSendSuggestion(null)
      return
    }

    const localSuggestion = buildPreSendSuggestion({
      draft: trimmedDraft,
      messages,
    })

    if (localSuggestion?.type === 'soften') {
      if (localSuggestion.triggerKey === dismissedSuggestionKey) {
        setPreSendSuggestion(null)
      } else {
        setPreSendSuggestion(localSuggestion)
      }
      return
    }

    setPreSendSuggestion(null)
  }, [composerText, conversation, dismissedSuggestionKey, isRecordingVoice, messages])

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
            <button
              className="ghost-action"
              type="button"
              onClick={() => void handleMarkConversationRead()}
              disabled={markingRead || unreadCount === 0}
            >
              {markingRead ? '处理中...' : '一键已读'}
            </button>
            <button onClick={() => void handleInitiateVoiceCall()} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="Voice call">{'\u{1F4DE}'}</button>
            <button onClick={() => void handleInitiateVideoCall()} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }} title="Video call">{'\u{1F4F9}'}</button>
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
        {readFeedback ? <p className="state-note">{readFeedback}</p> : null}

        <div ref={messageListRef} className="message-list">
          {!loading && !error && messages.length === 0 ? (
            <PageState title="No messages yet" description="Send your first message to start this conversation." />
          ) : null}

          {messages.map((message) => {
            const messageText =
              (message.messageType !== 'Image' && message.messageType !== 'Voice' && message.messageType !== 'Video') || message.textContent
                ? (message.textContent ?? message.transcript ?? 'Voice message')
                : null
            const explainImageUrl = message.messageType === 'Image' ? message.mediaUrl ?? null : null
            const isIncomingMessage = message.senderType === 'Elder'
            const canExplain = Boolean((messageText || explainImageUrl) && isIncomingMessage)
            const bridgeState = generationBridgeByMessageId[message.id]
            const isBridgeOpen = bridgeState?.isOpen ?? false
            const explainLoading = bridgeState?.loading ?? false
            const explainError = bridgeState?.error
            const explainResult = bridgeState?.result

            return (
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
                  {messageText ? (
                    <div className="message-bridge-inline">
                      <p>{messageText}</p>
                    </div>
                  ) : null}
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
                <MessageAuxArea message={message} isMine={message.senderType === 'Family'} />
                {canExplain ? (
                  <button
                    className="message-bridge-trigger message-bridge-trigger--outside"
                    type="button"
                    disabled={explainLoading}
                    onClick={() => void handleExplainMessage(message)}
                    title="看不懂这句话？点这里让AI解释"
                    aria-label="代沟翻译"
                  >
                    ?
                  </button>
                ) : null}

                {canExplain && isBridgeOpen ? (
                  <div className="message-bridge-card">
                    <div className="message-bridge-card__header">
                      <span className="surface-card__eyebrow">AI解释</span>
                      <button
                        type="button"
                        className="message-bridge-close"
                        onClick={() => handleCloseExplainMessage(message.id)}
                        aria-label="收起解释"
                      >
                        收起
                      </button>
                    </div>
                    {explainLoading ? <p>AI 正在解释这句话...</p> : null}
                    {explainError ? <p className="state-note state-note--error">{explainError}</p> : null}
                    {explainResult ? (
                      <>
                        <p><strong>1. 这句话的意思：</strong>{explainResult.explanation}</p>
                        <p className="message-bridge-followup">
                          <strong>2. 建议回复：</strong>
                          {explainResult.followUpSuggestion ?? '我懂了，你再说详细一点。'}
                          <button
                            type="button"
                            className="ghost-action"
                            style={{ marginLeft: '10px' }}
                            onClick={() => handleApplyBridgeSuggestion(explainResult.followUpSuggestion)}
                          >
                            自动输入
                          </button>
                        </p>
                        {explainResult.hasMeme && explainResult.memeExplanation ? (
                          <p className="message-bridge-followup"><strong>3. 这句话里的梗：</strong>{explainResult.memeExplanation}</p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}

                {message.senderType === 'Elder' && message.emotion ? (
                  <div className={`message-emotion-chip message-emotion-chip--${toSeverityTone(message.emotion.severity)}`}>
                    <div className="message-emotion-chip__meta">
                      <span>{getEmotionSourceLabel(message.emotion.source)}</span>
                      <span className={`message-emotion-mode message-emotion-mode--${getEmotionModeTone(message.emotion.mode)}`}>
                        {getEmotionModeLabel(message.emotion.mode)}
                      </span>
                    </div>
                    <strong>{formatEmotionSummary(message.emotion.summary)}</strong>
                  </div>
                ) : null}
              </div>
            )
          })}
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

        {preSendSuggestion ? (
          <section className={`pre-send-suggestion-card pre-send-suggestion-card--${preSendSuggestion.type}`}>
            <div className="pre-send-suggestion-card__header">
              <div>
                <p className="surface-card__eyebrow">
                  {preSendSuggestion.type === 'soften' ? '情绪缓冲' : '接话续聊'}
                </p>
                <h3>{preSendSuggestion.title}</h3>
              </div>
              <button
                className="text-action"
                type="button"
                onClick={() => handleDismissSuggestion(preSendSuggestion.triggerKey)}
              >
                收起
              </button>
            </div>
            <p className="pre-send-suggestion-card__reason">{preSendSuggestion.reason}</p>
            <div className="pre-send-suggestion-card__list">
              {preSendSuggestion.suggestions.map((suggestion, index) => (
                <button
                  key={`${preSendSuggestion.triggerKey}-${index}`}
                  className="pre-send-suggestion-option"
                  type="button"
                  onClick={() => handleApplySuggestion(suggestion)}
                >
                  <span>{suggestion}</span>
                  <span className="status-pill">采用</span>
                </button>
              ))}
            </div>
            <div className="inline-actions">
              <button
                className="ghost-action"
                type="button"
                onClick={() => handleDismissSuggestion(preSendSuggestion.triggerKey)}
              >
                忽略
              </button>
              <button
                className="primary-action"
                type="button"
                disabled={sending || isRecordingVoice || !composerText.trim()}
                onClick={() => void handleSendCurrentText()}
              >
                {sending ? 'Sending...' : '继续发送原文'}
              </button>
            </div>
          </section>
        ) : null}

        {postSendFollowupSuggestion ? (
          <section className="pre-send-suggestion-card pre-send-suggestion-card--followup">
            <div className="pre-send-suggestion-card__header">
              <div>
                <p className="surface-card__eyebrow">发送后续聊</p>
                <h3>{postSendFollowupSuggestion.title}</h3>
              </div>
              <button
                className="text-action"
                type="button"
                onClick={() => handleDismissSuggestion(postSendFollowupSuggestion.triggerKey)}
              >
                收起
              </button>
            </div>
            <p className="pre-send-suggestion-card__reason">{postSendFollowupSuggestion.reason}</p>
            <div className="pre-send-suggestion-card__list">
              {postSendFollowupSuggestion.suggestions.map((suggestion, index) => (
                <button
                  key={`${postSendFollowupSuggestion.triggerKey}-${index}`}
                  className="pre-send-suggestion-option"
                  type="button"
                  onClick={() => handleApplySuggestion(suggestion)}
                >
                  <span>{suggestion}</span>
                  <span className="status-pill">用这句续聊</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {unreadSummaryState.isOpen ? (
          <div className="unread-summary-overlay" role="dialog" aria-modal="true" aria-label="未读消息摘要">
            <section className="unread-summary-dialog">
              <div className="unread-summary-dialog__header">
                <div>
                  <p className="surface-card__eyebrow">AI 未读摘要</p>
                  <h3>未读消息概要</h3>
                </div>
                <button className="ghost-action" type="button" onClick={handleCloseUnreadSummary}>
                  关闭
                </button>
              </div>
              {unreadSummaryState.loading ? <p className="state-note">AI 正在整理未读消息...</p> : null}
              {unreadSummaryState.error ? <p className="state-note state-note--error">{unreadSummaryState.error}</p> : null}
                  {unreadSummaryState.result ? (
                    <div className="unread-summary-dialog__body">
                  <div className="unread-summary-dialog__meta">
                    <span className="status-pill">未读 {unreadSummaryState.result.unreadCount}</span>
                    <span className="status-pill">{unreadSummaryState.result.mode === 'llm' ? 'AI 生成' : '快速摘要'}</span>
                  </div>
                  <div className="unread-summary-dialog__section">
                    <strong>概要</strong>
                    <p>{unreadSummaryState.result.summary}</p>
                  </div>
                  {unreadSummaryState.result.highlights.length > 0 ? (
                    <div className="unread-summary-dialog__section">
                      <strong>重点</strong>
                      <ul className="unread-summary-dialog__list">
                        {unreadSummaryState.result.highlights.map((item, index) => (
                          <li key={`${index}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                    </div>
                  ) : null}
                  <div className="inline-actions">
                    <button className="ghost-action" type="button" onClick={handleCloseUnreadSummary}>
                      关闭
                    </button>
                    <button
                      className="primary-action"
                      type="button"
                      onClick={() => void handleMarkConversationRead()}
                      disabled={markingRead || unreadCount === 0}
                    >
                      {markingRead ? '处理中...' : '一键已读'}
                    </button>
                  </div>
                </section>
              </div>
            ) : null}

        <form
          className={`composer-card ${isDraggingMedia ? 'composer-card--dragging' : ''}`}
          onSubmit={handleSubmit}
          onDragOver={handleComposerDragOver}
          onDragLeave={handleComposerDragLeave}
          onDrop={handleComposerDrop}
        >
          <div className="composer-input-row">
            <input
              aria-label="Input message"
              placeholder="Type a message..."
              value={composerText}
              onChange={(event) => {
                setComposerText(event.target.value)
                setDismissedSuggestionKey(null)
              }}
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
          {isDraggingMedia ? <p className="composer-drop-tip">松手后直接发送图片或视频</p> : null}
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
              <button
                className="ghost-action attachment-menu__button"
                type="button"
                disabled={sending || isRecordingVoice}
                onClick={() => void handleOpenUnreadSummary()}
              >
                未读摘要
              </button>
            </div>
          ) : null}
          <div className="inline-actions">
            <button className="ghost-action" type="button" onClick={() => setShowEmojiPanel((prev) => !prev)}>
              {'\u{1F600}'}
            </button>
            <button className="primary-action" type="submit" disabled={sending || isRecordingVoice || !composerText.trim()}>
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
      </section>
    </section>
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await handleSendCurrentText()
  }

  async function handleSendCurrentText() {
    if (!conversation || !composerText.trim()) {
      return
    }

    try {
      const nextText = composerText.trim()
      const followupSeed = buildPreSendSuggestion({
        draft: nextText,
        messages,
      })
      setSending(true)
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'Family',
        senderMemberId: conversation.familyMemberId,
        messageType: 'Text',
        textContent: nextText,
        aiDrafted: false,
        isLowInformation: isLowInformation(nextText),
      })
      setConversation(nextConversation)
      setComposerText('')
      setPreSendSuggestion(null)
      setPostSendFollowupSuggestion(null)
      setDismissedSuggestionKey(null)
      setError('')
      if (followupSeed?.type === 'followup') {
        void resolvePostSendFollowupSuggestion(nextText, followupSeed)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to send message')
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
        senderType: 'Family',
        senderMemberId: conversation.familyMemberId,
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
        senderType: 'Family',
        senderMemberId: conversation.familyMemberId,
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
      setIsDraggingMedia(false)
      setShowAttachmentOptions(false)
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
    }
  }

  function handleSelectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      void handleSendImage(file)
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
        senderType: 'Family',
        senderMemberId: conversation.familyMemberId,
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
      setIsDraggingMedia(false)
      setShowAttachmentOptions(false)
      if (videoInputRef.current) {
        videoInputRef.current.value = ''
      }
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
    setIsDraggingMedia(true)
  }

  function handleComposerDragLeave(event: DragEvent<HTMLFormElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setIsDraggingMedia(false)
  }

  function handleComposerDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsDraggingMedia(false)

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

  async function handleExplainMessage(message: Message) {
    const messageText = (message.textContent ?? message.transcript ?? '').trim()
    const imageUrl = message.messageType === 'Image' ? message.mediaUrl ?? null : null
    if (!messageText && !imageUrl) return
    const currentState = generationBridgeByMessageId[message.id]

    if (currentState?.isOpen) {
      setGenerationBridgeByMessageId((prev) => ({
        ...prev,
        [message.id]: {
          ...prev[message.id],
          isOpen: false,
          loading: false,
        },
      }))
      return
    }

    if (currentState?.result && !currentState.error) {
      setGenerationBridgeByMessageId((prev) => ({
        ...prev,
        [message.id]: {
          ...prev[message.id],
          isOpen: true,
        },
      }))
      return
    }

    setGenerationBridgeByMessageId((prev) => ({
      ...prev,
      [message.id]: {
        isOpen: true,
        loading: true,
        error: null,
        result: prev[message.id]?.result ?? null,
      },
    }))

    try {
      const result = await explainGenerationBridge({
        messageText: messageText || undefined,
        imageUrl: imageUrl || undefined,
        requesterRole: 'family',
        requesterName: conversation?.familyDisplayName || '家人',
        peerName: conversation?.elderDisplayName || '长辈',
      })
      setGenerationBridgeByMessageId((prev) => ({
        ...prev,
        [message.id]: {
          isOpen: true,
          loading: false,
          error: null,
          result,
        },
      }))
    } catch (explainError) {
      setGenerationBridgeByMessageId((prev) => ({
        ...prev,
        [message.id]: {
          isOpen: true,
          loading: false,
          error: explainError instanceof Error ? explainError.message : '解释失败，请稍后重试',
          result: null,
        },
      }))
    }
  }

  function handleCloseExplainMessage(messageId: string) {
    setGenerationBridgeByMessageId((prev) => {
      if (!prev[messageId]) return prev
      return {
        ...prev,
        [messageId]: {
          ...prev[messageId],
          isOpen: false,
          loading: false,
        },
      }
    })
  }

  function handlePickEmoji(emoji: string) {
    setComposerText((prev) => `${prev}${emoji}`)
    setDismissedSuggestionKey(null)
  }

  async function handleOpenUnreadSummary() {
    if (!conversation) {
      return
    }

    setShowAttachmentOptions(false)
    setUnreadSummaryState({
      isOpen: true,
      loading: true,
      error: null,
      result: null,
    })

    try {
      const result = await getUnreadSummary({
        conversationId: conversation.id,
        requesterRole: 'family',
      })

      setUnreadSummaryState({
        isOpen: true,
        loading: false,
        error: null,
        result,
      })
    } catch (summaryError) {
      setUnreadSummaryState({
        isOpen: true,
        loading: false,
        error: summaryError instanceof Error ? summaryError.message : '未读摘要生成失败，请稍后再试',
        result: null,
      })
    }
  }

  async function handleMarkConversationRead() {
    if (!conversation || unreadCount === 0) {
      setReadFeedback('现在没有新的未读消息')
      return
    }

    try {
      setMarkingRead(true)
      setReadFeedback('')
      const result = await markConversationRead(conversation.id, {
        requesterRole: 'family',
      })

      if (result.conversation) {
        setConversation(result.conversation)
      }

      setUnreadSummaryState((prev) => (
        prev.isOpen
          ? {
              ...prev,
              loading: false,
              error: null,
              result: {
                unreadCount: 0,
                summary: '现在没有新的未读消息。',
                highlights: [],
                mode: prev.result?.mode ?? 'fallback',
              },
            }
          : prev
      ))
      setReadFeedback(result.updatedCount > 0 ? '已全部标为已读' : '现在没有新的未读消息')
      setError('')
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : '一键已读失败')
    } finally {
      setMarkingRead(false)
    }
  }

  function handleCloseUnreadSummary() {
    setUnreadSummaryState((prev) => ({
      ...prev,
      isOpen: false,
      loading: false,
    }))
  }

  function handleDismissSuggestion(triggerKey: string) {
    setDismissedSuggestionKey(triggerKey)
    setPreSendSuggestion(null)
    setPostSendFollowupSuggestion(null)
  }

  function handleApplySuggestion(suggestion: string) {
    setComposerText(suggestion)
    setDismissedSuggestionKey(null)
    setPreSendSuggestion(null)
    setPostSendFollowupSuggestion(null)
  }

  function handleApplyBridgeSuggestion(suggestion: string | null | undefined) {
    const nextSuggestion = (suggestion ?? '').trim()
    if (!nextSuggestion) {
      return
    }

    setComposerText(nextSuggestion)
    setDismissedSuggestionKey(null)
  }

  async function resolvePostSendFollowupSuggestion(trimmedDraft: string, localSuggestion: PreSendSuggestion) {
    const requestId = preSendRequestRef.current + 1
    preSendRequestRef.current = requestId

    try {
      const response = await getPreSendSuggestion({
        conversationId: conversation?.id ?? targetId,
        draft: trimmedDraft,
        messages: messages.slice(-5).map((message) => ({
          id: message.id,
          senderType: message.senderType,
          messageType: message.messageType,
          textContent: message.textContent,
          transcript: message.transcript,
          mediaUrl: message.mediaUrl,
          createdAt: message.createdAt,
        })),
      })

      if (preSendRequestRef.current !== requestId) {
        return
      }

      const nextSuggestion = response.result?.type === 'followup' ? response.result : localSuggestion
      if (!nextSuggestion || nextSuggestion.triggerKey === dismissedSuggestionKey) {
        setPostSendFollowupSuggestion(null)
        return
      }

      setPostSendFollowupSuggestion(nextSuggestion)
      return
    } catch (error) {
      console.warn('[post-send-followup] falling back to local rules', error)
    }

    if (preSendRequestRef.current !== requestId) {
      return
    }

    if (!localSuggestion || localSuggestion.triggerKey === dismissedSuggestionKey) {
      setPostSendFollowupSuggestion(null)
      return
    }

    setPostSendFollowupSuggestion(localSuggestion)
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

function getEmotionModeLabel(mode: string | null | undefined) {
  return mode === 'fallback' ? '兜底' : 'AI'
}

function getEmotionModeTone(mode: string | null | undefined) {
  return mode === 'fallback' ? 'fallback' : 'ai'
}
