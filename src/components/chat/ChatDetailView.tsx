import React, { useEffect, useState, useRef, useCallback } from 'react'
import { IMessage, IConversation, MessageType, MessageStatus } from '../../services/api/types'
import * as chatApi from '../../services/api/chatApi'
import { messageStore } from '../../utils/storage'
import { webrtcManager, CallType } from '../../services/webrtc/WebRTCManager'
import { networkAdapter, QualityLevel } from '../../services/webrtc/NetworkAdapt'
import ChatMessage from '../chat/ChatMessage'
import ChatInput from '../chat/ChatInput'
import ChatList from '../chat/ChatList'
import VoiceCall from '../chat/VoiceCall'
import VideoCall from '../chat/VideoCall'
import { notifyIncomingCall } from '../../utils/notification'
import styles from './ChatDetailView.module.css'

interface ChatDetailViewProps {
  currentUserId: string
  otherUserId: string
  otherUserName: string
  otherUserAvatar?: string
  isFamilyStyle?: boolean
  presetMessages?: string[]
}

const ChatDetailView: React.FC<ChatDetailViewProps> = ({
  currentUserId,
  otherUserId,
  otherUserName,
  otherUserAvatar,
  isFamilyStyle = false,
  presetMessages = []
}) => {
  const [messages, setMessages] = useState<IMessage[]>([])
  const [conversation, setConversation] = useState<IConversation | null>(null)
  const [isCallActive, setIsCallActive] = useState(false)
  const [callType, setCallType] = useState<CallType | null>(null)
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isIncomingCall, setIsIncomingCall] = useState(false)
  const [networkQuality, setNetworkQuality] = useState<QualityLevel>('high')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const callTimerRef = useRef<number>(0)
  const statsCheckIntervalRef = useRef<number>(0)
  const unsubscribeMessageRef = useRef<(() => void) | null>(null)
  const conversationIdRef = useRef(`${currentUserId}-${otherUserId}`)

  // 初始化：加载历史消息和对话
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // 获取对话
        const conv = await chatApi.getConversation(currentUserId, otherUserId)
        if (conv) {
          setConversation(conv)
        } else {
          // 创建新对话
          const newConv: IConversation = {
            id: conversationIdRef.current,
            userId: currentUserId,
            otherUserId,
            otherUserName,
            otherUserAvatar,
            unreadCount: 0,
            lastActivityAt: Date.now()
          }
          await chatApi.saveConversation(newConv)
          setConversation(newConv)
        }

        // 加载消息
        const msgs = await chatApi.getMessages(conversationIdRef.current, 50)
        setMessages(msgs)

        // 订阅新消息
        const unsubscribe = chatApi.onConversationMessage(
          conversationIdRef.current,
          (msg) => {
            setMessages((prev) => [...prev, msg])
            // 更新对话最后消息
            if (conversation) {
              conversation.lastMessage = msg.content
              conversation.lastActivityAt = msg.timestamp
              chatApi.saveConversation(conversation)
            }
          }
        )

        unsubscribeMessageRef.current = unsubscribe

        // 标记为已读
        const unreadMessages = msgs.filter((m) => !m.isMine && m.status !== MessageStatus.READ)
        if (unreadMessages.length > 0) {
          await chatApi.markMessagesAsRead(unreadMessages.map((m) => m.id))
        }
      } catch (error) {
        console.error('[Chat] Failed to initialize:', error)
      }
    }

    initializeChat()

    return () => {
      if (unsubscribeMessageRef.current) {
        unsubscribeMessageRef.current()
      }
    }
  }, [currentUserId, otherUserId])

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // WebRTC 事件监听
  useEffect(() => {
    const unsubscribeConnected = webrtcManager.on('call-connected', () => {
      setCallState('connected')
      // 开始监测网络质量
      startNetworkQualityMonitoring()
    })

    const unsubscribeEnded = webrtcManager.on('call-ended', () => {
      setCallState('ended')
      setIsCallActive(false)
      setCallDuration(0)
      stopNetworkQualityMonitoring()
      setTimeout(() => setCallState('idle'), 500)
    })

    return () => {
      unsubscribeConnected()
      unsubscribeEnded()
    }
  }, [])

  // 开始监测网络质量
  const startNetworkQualityMonitoring = () => {
    statsCheckIntervalRef.current = window.setInterval(async () => {
      const stats = await webrtcManager.getStats()
      if (stats) {
        const networkStats = networkAdapter.analyzeStats(stats)
        const level = networkAdapter.getQualityLevel(networkStats)
        setNetworkQuality(level)

        // 自动调整通话质量
        const pc = (webrtcManager as any).callSession?.peerConnection
        if (pc && level !== networkQuality) {
          await networkAdapter.applyQuality(pc, level)
        }
      }
    }, 5000)
  }

  // 停止监测网络质量
  const stopNetworkQualityMonitoring = () => {
    if (statsCheckIntervalRef.current) {
      clearInterval(statsCheckIntervalRef.current)
    }
  }

  // 发送消息
  const handleSendMessage = async (text: string) => {
    try {
      await chatApi.sendMessage({
        conversationId: conversationIdRef.current,
        senderId: currentUserId,
        recipientId: otherUserId,
        content: text,
        type: MessageType.TEXT
      })
    } catch (error) {
      console.error('[Chat] Failed to send message:', error)
    }
  }

  // 发起语音通话
  const handleInitiateVoiceCall = async () => {
    try {
      setIsCallActive(true)
      setCallType('voice')
      setCallState('ringing')
      setIsIncomingCall(false)

      // 设置 Signaling 客户端
      webrtcManager.setSignalingClient(async (signal) => {
        // 通过 WebSocket 发送信令
        if (chatApi.isWebSocketConnected()) {
          // 需要在生产环境中实现具体的信令发送逻辑
        }
      })

      await webrtcManager.initiateCall(currentUserId, otherUserId, 'voice')
    } catch (error) {
      console.error('[Chat] Failed to initiate voice call:', error)
      setIsCallActive(false)
      setCallState('idle')
    }
  }

  // 发起视频通话
  const handleInitiateVideoCall = async () => {
    try {
      setIsCallActive(true)
      setCallType('video')
      setCallState('ringing')
      setIsIncomingCall(false)

      webrtcManager.setSignalingClient(async (signal) => {
        // 通过 WebSocket 发送信令
      })

      await webrtcManager.initiateCall(currentUserId, otherUserId, 'video')
    } catch (error) {
      console.error('[Chat] Failed to initiate video call:', error)
      setIsCallActive(false)
      setCallState('idle')
    }
  }

  // 接听通话
  const handleAcceptCall = async () => {
    try {
      setCallState('connecting')
      // 实现具体的接听逻辑
    } catch (error) {
      console.error('[Chat] Failed to accept call:', error)
    }
  }

  // 拒接通话
  const handleRejectCall = async () => {
    try {
      await webrtcManager.rejectCall(currentUserId, otherUserId, 'call-id')
      setIsCallActive(false)
      setCallState('idle')
    } catch (error) {
      console.error('[Chat] Failed to reject call:', error)
    }
  }

  // 挂断通话
  const handleHangupCall = () => {
    webrtcManager.hangup()
    setIsCallActive(false)
    setCallState('ended')
  }

  // 切换音频
  const handleToggleMute = (isMuted: boolean) => {
    setIsMuted(isMuted)
    webrtcManager.toggleAudio(!isMuted)
  }

  // 切换摄像头
  const handleToggleCamera = (isCameraOn: boolean) => {
    setIsCameraOn(isCameraOn)
    webrtcManager.toggleVideo(isCameraOn)
  }

  return (
    <div className={`${styles.container} ${isFamilyStyle ? styles.familyStyle : styles.normalStyle}`}>
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          {otherUserAvatar && (
            <img src={otherUserAvatar} alt={otherUserName} className={styles.headerAvatar} />
          )}
          <div className={styles.headerInfo}>
            <h2 className={styles.userName}>{otherUserName}</h2>
            {networkQuality !== 'high' && (
              <p className={styles.networkQuality}>网络: {networkQuality}</p>
            )}
          </div>
        </div>

        <div className={styles.callButtons}>
          <button
            onClick={handleInitiateVoiceCall}
            className={styles.callButton}
            title="语音通话"
          >
            📞
          </button>
          <button
            onClick={handleInitiateVideoCall}
            className={styles.callButton}
            title="视频通话"
          >
            📹
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className={styles.messagesContainer}>
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            isMine={msg.senderId === currentUserId}
            senderAvatar={msg.senderId === otherUserId ? otherUserAvatar : undefined}
            senderName={otherUserName}
            isFamilyStyle={isFamilyStyle}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isFamilyStyle={isFamilyStyle}
        presetMessages={presetMessages}
      />

      {/* 通话UI */}
      {isCallActive && callType === 'voice' && (
        <VoiceCall
          remoteUser={{ id: otherUserId, name: otherUserName, avatar: otherUserAvatar }}
          callState={callState}
          duration={callDuration}
          isIncoming={isIncomingCall}
          isMuted={isMuted}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onHangup={handleHangupCall}
          onToggleMute={handleToggleMute}
          isFamilyStyle={isFamilyStyle}
        />
      )}

      {isCallActive && callType === 'video' && (
        <VideoCall
          remoteUser={{ id: otherUserId, name: otherUserName, avatar: otherUserAvatar }}
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
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          isFamilyStyle={isFamilyStyle}
        />
      )}
    </div>
  )
}

export default ChatDetailView
