import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
  readCachedConversationDetail,
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
import { ensureCallMediaPermission, ensureMicrophoneCapturePermission } from '../../platform/permissions'
import { webrtcManager } from '../../services/webrtc/WebRTCManager'
import * as chatApi from '../../services/api/chatApi'
import VoiceCall from '../../components/chat/VoiceCall'
import VideoCall from '../../components/chat/VideoCall'
import { buildPreSendSuggestion } from '../../domain/content/preSendSuggestions'
import { useVideoCallEmotionSummary } from '../../utils/hooks/useVideoCallEmotionSummary'
import { getOnboardingState } from '../../app/onboardingStorage'

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

export function FamilyConversationPage() {
  const { conversationId, userId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const targetId = userId || conversationId || ''
  const [conversation, setConversation] = useState<ConversationDetail | null>(() => (targetId ? readAuthorizedCachedConversation(targetId) : null))
  const [familySpaceId, setFamilySpaceId] = useState('fs_demo')
  const [loading, setLoading] = useState(() => !(targetId && readAuthorizedCachedConversation(targetId)))
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
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null)
  const [focusedMessageHintId, setFocusedMessageHintId] = useState<string | null>(null)
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
  const [activeCallId, setActiveCallId] = useState<string | null>(null)

  const isCallerRef = useRef(false)
  const incomingOfferRef = useRef<string | null>(null)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const voiceSessionRef = useRef<VoiceRecordingSession | null>(null)
  const voiceTimerRef = useRef<number>(0)
  const preSendRequestRef = useRef(0)
  const messageElementMapRef = useRef(new Map<string, HTMLDivElement>())

  const clearVoiceTimer = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current)
      voiceTimerRef.current = 0
    }
  }

  const currentUserId = conversation?.familyMemberId ?? null
  const otherUserId = conversation?.elderMemberId ?? null
  const { finishSummary: finishVideoEmotionSummary } = useVideoCallEmotionSummary({
    enabled: isCallActive && callState === 'connected' && callType === 'video',
    conversationId: conversation?.id ?? null,
    familySpaceId,
    targetVideoStream: callType === 'video' ? remoteCallStream : null,
    shouldSubmit: isCallerRef.current,
  })

  const syncConversation = async () => {
    if (!targetId) return
    try {
      const nextConversation = await getConversationDetail(targetId)
      setConversation(nextConversation)
    } catch (err) {
      console.error('Failed to sync conversation', err)
    }
  }

  useEffect(() => {
    if (!targetId) return
    const cachedConversation = readAuthorizedCachedConversation(targetId)
    if (cachedConversation) {
      setConversation(cachedConversation)
      setLoading(false)
    }
  }, [targetId])

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
        setActiveCallId(signal.callId)
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
          void logCallSystemMessage('对方暂时没有接听这次通话。')
        }
        setActiveCallId(null)
        setIsCallActive(false)
        setCallState('idle')
        setLocalCallStream(null)
        setRemoteCallStream(null)
      } else if (signal.type === 'hangup') {
        webrtcManager.hangup()
        setActiveCallId(null)
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
      setActiveCallId(null)
      setLocalCallStream(null)
      setRemoteCallStream(null)
      setTimeout(() => setCallState('idle'), 500)

      if (isCallerRef.current && isCallEndedPayload(data) && typeof data.duration === 'number' && callState === 'connected') {
        const durationSecs = Math.round(data.duration / 1000)
        if (callType === 'video') {
          void finishVideoEmotionSummary(data.duration).then(() => {
            void syncConversation()
          })
        } else {
          void logCallSystemMessage(`本次通话已结束，通话时长约 ${durationSecs} 秒。`)
        }
      }
    })

    return () => {
      unsubscribeConnected()
      unsubscribeEnded()
      chatApi.setConversationUpdateHandler(null)
      chatApi.setWebrtcSignalHandler(null)
    }
  }, [callState, callType, conversation, currentUserId, finishVideoEmotionSummary, otherUserId])

  const handleAcceptCall = async () => {
    if (!currentUserId || !otherUserId) return
    try {
      const allowed = await ensureCallMediaPermission(callType)
      if (!allowed) {
        setError(callType === 'video' ? '请先打开摄像头和麦克风权限，再接听视频通话。' : '请先打开麦克风权限，再接听语音通话。')
        setIsCallActive(false)
        setIsIncomingCall(false)
        setCallState('idle')
        return
      }

      setCallState('connecting')
      if (incomingOfferRef.current) {
        await webrtcManager.acceptCall(
          currentUserId,
          { type: 'offer', sdp: incomingOfferRef.current } as RTCSessionDescription,
          otherUserId,
          callType,
          activeCallId ?? `${otherUserId}-${currentUserId}`,
        )
        setActiveCallId(webrtcManager.getCallId())
        if (callType === 'video') {
          setIsCameraOn(true)
          webrtcManager.toggleVideo(true)
        }
        setLocalCallStream(webrtcManager.getLocalStream())
        setRemoteCallStream(webrtcManager.getRemoteStream())
        setIsIncomingCall(false)
      }
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : '接听失败，请稍后再试。')
      setIsCallActive(false)
      setCallState('idle')
    }
  }

  const handleRejectCall = async () => {
    if (!currentUserId || !otherUserId || !activeCallId) return
    await webrtcManager.rejectCall(currentUserId, otherUserId, activeCallId)
    setActiveCallId(null)
    setIsCallActive(false)
    setCallState('idle')
    setLocalCallStream(null)
    setRemoteCallStream(null)
  }

  const handleHangupCall = () => {
    if (!currentUserId || !otherUserId || !activeCallId) return
    chatApi.sendWebrtcSignal({
      type: 'hangup',
      from: currentUserId,
      to: otherUserId,
      callId: activeCallId,
      timestamp: Date.now(),
    })
    webrtcManager.hangup()
    setActiveCallId(null)
    setIsCallActive(false)
    setCallState('ended')
    setLocalCallStream(null)
    setRemoteCallStream(null)
  }

  const handleInitiateVoiceCall = async () => {
    if (!currentUserId || !otherUserId) return
    try {
      const allowed = await ensureCallMediaPermission('voice')
      if (!allowed) {
        setError('请先打开麦克风权限，再发起语音通话。')
        return
      }

      isCallerRef.current = true
      setIsCallActive(true)
      setCallType('voice')
      setCallState('ringing')
      setIsIncomingCall(false)
      await webrtcManager.initiateCall(currentUserId, otherUserId, 'voice')
      setActiveCallId(webrtcManager.getCallId())
      await sendOutgoingCallMessage('voice')
      setLocalCallStream(webrtcManager.getLocalStream())
      setRemoteCallStream(webrtcManager.getRemoteStream())
      setError('')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : '语音通话暂时无法发起，请稍后再试。')
      setIsCallActive(false)
      setCallState('idle')
    }
  }

  const handleInitiateVideoCall = async () => {
    if (!currentUserId || !otherUserId) return
    try {
      const allowed = await ensureCallMediaPermission('video')
      if (!allowed) {
        setError('请先打开摄像头和麦克风权限，再发起视频通话。')
        return
      }

      isCallerRef.current = true
      setIsCallActive(true)
      setCallType('video')
      setCallState('ringing')
      setIsIncomingCall(false)
      await webrtcManager.initiateCall(currentUserId, otherUserId, 'video')
      setActiveCallId(webrtcManager.getCallId())
      await sendOutgoingCallMessage('video')
      setIsCameraOn(true)
      webrtcManager.toggleVideo(true)
      setLocalCallStream(webrtcManager.getLocalStream())
      setRemoteCallStream(webrtcManager.getRemoteStream())
      setError('')
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : '视频通话暂时无法发起，请稍后再试。')
      setIsCallActive(false)
      setCallState('idle')
    }
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
          setError(loadError instanceof Error ? loadError.message : '这段聊天暂时没有加载出来，请稍后再试。')
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
  const requestedMessageId = searchParams.get('messageId')
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
    if (!requestedMessageId || loading || messages.length === 0) {
      return
    }

    const targetMessage = messages.find((message) => message.id === requestedMessageId)
    const element = messageElementMapRef.current.get(requestedMessageId)
    if (!targetMessage || !element) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      setFocusedMessageId(requestedMessageId)
      setFocusedMessageHintId(requestedMessageId)
    })

    const hintTimer = window.setTimeout(() => {
      setFocusedMessageHintId((current) => (current === requestedMessageId ? null : current))
    }, 2200)

    const highlightTimer = window.setTimeout(() => {
      setFocusedMessageId((current) => (current === requestedMessageId ? null : current))
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('messageId')
        return next
      }, { replace: true })
    }, 2800)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(hintTimer)
      window.clearTimeout(highlightTimer)
    }
  }, [loading, messages, requestedMessageId, setSearchParams])

  useEffect(() => {
    return () => {
      clearVoiceTimer()

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
        <div className="family-chat-header">
          <Link className="family-chat-header__back" to="/family/chats" aria-label="返回聊天列表">
            <span aria-hidden="true">‹</span>
          </Link>
          <h2>{conversation?.elderDisplayName ?? '家人'}</h2>
          <div className="family-chat-header__spacer" aria-hidden="true" />
        </div>

        {isCallActive && callType === 'voice' && (
          <VoiceCall
            remoteUser={{ id: otherUserId ?? '', name: conversation?.elderDisplayName || '家人', avatar: conversation?.avatar }}
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
            remoteUser={{ id: otherUserId ?? '', name: conversation?.elderDisplayName || '家人', avatar: conversation?.avatar }}
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

        {loading ? <PageState title="正在打开聊天" description="稍等一下，正在准备这段对话。" /> : null}
        {error ? <PageState variant="error" title="暂时无法查看这段聊天" description={error} /> : null}
        {memoryFeedback ? <p className="state-note">{memoryFeedback}</p> : null}
        {readFeedback ? <p className="state-note">{readFeedback}</p> : null}

        <div ref={messageListRef} className="message-list">
          {!loading && !error && messages.length === 0 ? (
            <PageState title="现在还没有聊天内容" description="发出第一条消息后，这里就会出现对话记录。" />
          ) : null}

          {messages.map((message) => {
            const messageText =
              (message.messageType !== 'Image' && message.messageType !== 'Voice' && message.messageType !== 'Video') || message.textContent
                ? (message.textContent ?? message.transcript ?? '语音消息')
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
                ref={(node) => {
                  if (node) {
                    messageElementMapRef.current.set(message.id, node)
                  } else {
                    messageElementMapRef.current.delete(message.id)
                  }
                }}
                className={`message-thread message-thread--${message.senderType === 'Family' ? 'self' : 'peer'}`}
              >
                <article
                  className={`message-bubble message-bubble--${message.senderType === 'Family' ? 'self' : 'peer'}${focusedMessageId === message.id ? ' message-bubble--focused' : ''}`}
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
                      {savingMemoryId === message.id ? '保存中...' : '加入回忆'}
                    </button>
                    {message.aiDrafted ? <span className="status-pill">已帮你整理</span> : null}
                  </footer>
                </article>
                {focusedMessageHintId === message.id ? (
                  <div className="message-focus-hint">已定位到相关消息</div>
                ) : null}
              </div>
            )
          })}
        </div>

        {showEmojiPanel ? (
          <div className="family-chat-emoji-panel">
            {STATIC_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="family-chat-emoji-panel__item"
                onClick={() => handlePickEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
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
              aria-label="输入消息"
              placeholder="输入你想说的话"
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
              <button
                className="ghost-action attachment-menu__button"
                type="button"
                disabled={sending || isRecordingVoice}
                onClick={() => {
                  setShowAttachmentOptions(false)
                  void handleInitiateVoiceCall()
                }}
              >
                语音通话
              </button>
              <button
                className="ghost-action attachment-menu__button"
                type="button"
                disabled={sending || isRecordingVoice}
                onClick={() => {
                  setShowAttachmentOptions(false)
                  void handleInitiateVideoCall()
                }}
              >
                视频通话
              </button>
            </div>
          ) : null}
          <div className="inline-actions">
            <button
              className="ghost-action family-chat-composer__emoji"
              type="button"
              onClick={() => setShowEmojiPanel((prev) => !prev)}
            >
              {'\u{1F600}'}
            </button>
            <button className="primary-action" type="submit" disabled={sending || isRecordingVoice || !composerText.trim()}>
              {sending ? '发送中...' : '发送'}
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
      setError(submitError instanceof Error ? submitError.message : '这条消息暂时没有发出去，请稍后再试。')
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
      if (sending || voiceSessionRef.current) {
        return
      }

      setError('')
      const allowed = await ensureMicrophoneCapturePermission()
      if (!allowed) {
        setError('请先打开麦克风权限，再试一次。')
        return
      }

      const session = await startVoiceRecording()
      voiceSessionRef.current = session
      setIsRecordingVoice(true)
      setVoiceDurationMs(0)
      clearVoiceTimer()
      voiceTimerRef.current = window.setInterval(() => {
        setVoiceDurationMs(Date.now() - session.startedAt)
      }, 200)
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : '暂时无法开始录音，请稍后再试。')
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
      setError(recordError instanceof Error ? recordError.message : '语音暂时没有发出去，请稍后再试。')
    } finally {
      voiceSessionRef.current = null
      setIsRecordingVoice(false)
      setVoiceDurationMs(0)
      clearVoiceTimer()
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
      setError(sendError instanceof Error ? sendError.message : '图片暂时没有发出去，请稍后再试。')
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
      setError(sendError instanceof Error ? sendError.message : '视频暂时没有发出去，请稍后再试。')
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
      setMemoryFeedback('已经加入回忆。')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '暂时没有加入回忆，请稍后再试。')
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
      setReadFeedback('现在没有新的未读消息。')
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
      setReadFeedback(result.updatedCount > 0 ? '已经帮你标为已读。' : '现在没有新的未读消息。')
      setError('')
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : '暂时没能完成已读处理，请稍后再试。')
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
      if (response.result?.type === 'followup') {
        console.info('[pre-send-suggestion] using server suggestion', {
          scenario: response.result.scenario,
          framework: response.result.framework,
          sourceModel: response.result.sourceModel,
          confidence: response.result.confidence,
        })
      }

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

    console.info('[pre-send-suggestion] using local fallback', {
      scenario: localSuggestion.scenario,
      framework: localSuggestion.framework,
      sourceModel: localSuggestion.sourceModel,
      confidence: localSuggestion.confidence,
    })
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
    return conversation?.familyDisplayName ?? '我'
  }

  return conversation?.elderDisplayName ?? '长辈'
}

function isLowInformation(input: string) {
  const normalized = input.replace(/\s+/g, '').trim().toLowerCase()
  return [
    '嗯',
    '嗯嗯',
    '好的',
    '好的呢',
    '收到',
    '知道了',
    '知道啦',
    '还行',
    '不错',
    '好',
    '挺好',
    '挺好的',
    '还好',
    '行',
    '行吧',
    '没事',
    '还可以',
    '一般',
    'ok',
    'yes',
    'received',
    'gotit',
  ].includes(normalized)
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

function readAuthorizedCachedConversation(conversationId: string) {
  const cachedConversation = readCachedConversationDetail(conversationId)
  if (!cachedConversation) {
    return null
  }

  const currentMemberId = getOnboardingState().memberId
  return cachedConversation.familyMemberId === currentMemberId ? cachedConversation : null
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
  return mode === 'fallback' ? '基础分析' : '智能分析'
}

function getEmotionModeTone(mode: string | null | undefined) {
  return mode === 'fallback' ? 'fallback' : 'ai'
}
