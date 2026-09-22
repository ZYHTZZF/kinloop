import React, { useEffect, useState, useRef } from 'react'
import { IMessage, IConversation, MessageType, MessageStatus } from '../../services/api/types'
import * as chatApi from '../../services/api/chatApi'
import { webrtcManager, CallType } from '../../services/webrtc/WebRTCManager'
import { networkAdapter, QualityLevel } from '../../services/webrtc/NetworkAdapt'
import ChatMessage from '../chat/ChatMessage'
import ChatInput from '../chat/ChatInput'
import VoiceCall from '../chat/VoiceCall'
import VideoCall from '../chat/VideoCall'
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
  const statsCheckIntervalRef = useRef<number>(0)
  const unsubscribeMessageRef = useRef<(() => void) | null>(null)
  const conversationIdRef = useRef(`${currentUserId}-${otherUserId}`)

  // 鍒濆鍖栵細鍔犺浇鍘嗗彶娑堟伅鍜屽璇?
  useEffect(() => {
    const initializeChat = async () => {
      try {
        if (!chatApi.isWebSocketConnected()) {
          try {
             await chatApi.initWebSocket('ws://localhost:3001', currentUserId)
          } catch (e) {
             console.error('Failed to init WS', e)
          }
        }
        // 鑾峰彇瀵硅瘽
        const conv = await chatApi.getConversation(currentUserId, otherUserId)
        if (conv) {
          setConversation(conv)
        } else {
          // 鍒涘缓鏂板璇?
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

        // 鍔犺浇娑堟伅
        const msgs = await chatApi.getMessages(conversationIdRef.current, 50)
        setMessages(msgs)

        // 璁㈤槄鏂版秷鎭?
        const unsubscribe = chatApi.onConversationMessage(
          conversationIdRef.current,
          (msg) => {
            setMessages((prev) => [...prev, msg])
            // 鏇存柊瀵硅瘽鏈€鍚庢秷鎭?
            if (conversation) {
              conversation.lastMessage = msg.content
              conversation.lastActivityAt = msg.timestamp
              chatApi.saveConversation(conversation)
            }
          }
        )

        unsubscribeMessageRef.current = unsubscribe

        // 鏍囪涓哄凡璇?
        const unreadMessages = msgs.filter((m) => m.senderId !== currentUserId && m.status !== MessageStatus.READ)
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

  // 婊氬姩鍒板簳閮?
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 寮€濮嬬洃娴嬬綉缁滆川閲?
  const startNetworkQualityMonitoring = () => {
    statsCheckIntervalRef.current = window.setInterval(async () => {
      const stats = await webrtcManager.getStats()
      if (stats) {
        const networkStats = networkAdapter.analyzeStats(stats)
        const level = networkAdapter.getQualityLevel(networkStats)
        setNetworkQuality(level)
        // Quality level is tracked for UI; transport adaptation can be wired later.
      }
    }, 5000)
  }

  // 鍋滄鐩戞祴缃戠粶璐ㄩ噺
  const stopNetworkQualityMonitoring = () => {
    if (statsCheckIntervalRef.current) {
      clearInterval(statsCheckIntervalRef.current)
    }
  }

  // WebRTC 浜嬩欢鐩戝惉
  useEffect(() => {
    // 缁戝畾 WebRTC 淇″彿灞?
    webrtcManager.setSignalingClient(async (signal) => {
      chatApi.sendWebrtcSignal({ ...signal, to: otherUserId, from: currentUserId })
    })
    
    // 鐩戝惉 WebSocket 鏀跺埌鐨?WebRTC 淇″彿
    chatApi.setWebrtcSignalHandler(async (signal) => {
      // 濡傛灉鏀跺埌鏉ヨ嚜瀵规柟鐨?offer锛岃鏄庢湁鍛煎叆鏉ョ數
      if (signal.type === 'offer') {
        setIsCallActive(true)
        setCallType(signal.callType || 'voice')
        setCallState('ringing')
        setIsIncomingCall(true)
      } else if (signal.type === 'answer' && signal.data?.sdp) {
        await webrtcManager.handleAnswer({ type: 'answer', sdp: signal.data.sdp } as RTCSessionDescription)
      } else if (signal.type === 'ice-candidate' && signal.data) {
        await webrtcManager.handleIceCandidate(new RTCIceCandidate(signal.data))
      } else if (signal.type === 'reject') {
        setIsCallActive(false)
        setCallState('idle')
      } else if (signal.type === 'hangup') {
        setIsCallActive(false)
        setCallState('ended')
        setTimeout(() => setCallState('idle'), 500)
      }
    })

    const unsubscribeConnected = webrtcManager.on('call-connected', () => {
      setCallState('connected')
      // 寮€濮嬬洃娴嬬綉缁滆川閲?
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

  // 鍙戦€佹秷鎭?
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

  // 鍙戣捣璇煶閫氳瘽
  const handleInitiateVoiceCall = async () => {
    try {
      setIsCallActive(true)
      setCallType('voice')
      setCallState('ringing')
      setIsIncomingCall(false)

      await webrtcManager.initiateCall(currentUserId, otherUserId, 'voice')
    } catch (error) {
      console.error('[Chat] Failed to initiate voice call:', error)
      setIsCallActive(false)
      setCallState('idle')
    }
  }

  // 鍙戣捣瑙嗛閫氳瘽
  const handleInitiateVideoCall = async () => {
    try {
      setIsCallActive(true)
      setCallType('video')
      setCallState('ringing')
      setIsIncomingCall(false)

      await webrtcManager.initiateCall(currentUserId, otherUserId, 'video')
    } catch (error) {
      console.error('[Chat] Failed to initiate video call:', error)
      setIsCallActive(false)
      setCallState('idle')
    }
  }

  // 鎺ュ惉閫氳瘽
  const handleAcceptCall = async () => {
    try {
      setCallState('connecting')
      // 瀹炵幇鍏蜂綋鐨勬帴鍚€昏緫
    } catch (error) {
      console.error('[Chat] Failed to accept call:', error)
    }
  }

  // 鎷掓帴閫氳瘽
  const handleRejectCall = async () => {
    try {
      await webrtcManager.rejectCall(currentUserId, otherUserId, 'call-id')
      setIsCallActive(false)
      setCallState('idle')
    } catch (error) {
      console.error('[Chat] Failed to reject call:', error)
    }
  }

  // 鎸傛柇閫氳瘽
  const handleHangupCall = () => {
    webrtcManager.hangup()
    setIsCallActive(false)
    setCallState('ended')
  }

  // 鍒囨崲闊抽
  const handleToggleMute = (isMuted: boolean) => {
    setIsMuted(isMuted)
    webrtcManager.toggleAudio(!isMuted)
  }

  // 鍒囨崲鎽勫儚澶?
  const handleToggleCamera = (isCameraOn: boolean) => {
    setIsCameraOn(isCameraOn)
    webrtcManager.toggleVideo(isCameraOn)
  }

  return (
    <div className={`${styles.container} ${isFamilyStyle ? styles.familyStyle : styles.normalStyle}`}>
      {/* 澶撮儴 */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          {otherUserAvatar && (
            <img src={otherUserAvatar} alt={otherUserName} className={styles.headerAvatar} />
          )}
          <div className={styles.headerInfo}>
            <h2 className={styles.userName}>{otherUserName}</h2>
            {networkQuality !== 'high' && (
              <p className={styles.networkQuality}>缃戠粶: {networkQuality}</p>
            )}
          </div>
        </div>

        <div className={styles.callButtons}>
          <button
            onClick={handleInitiateVoiceCall}
            className={styles.callButton}
            title="璇煶閫氳瘽"
          >
            馃摓
          </button>
          <button
            onClick={handleInitiateVideoCall}
            className={styles.callButton}
            title="瑙嗛閫氳瘽"
          >
            馃摴
          </button>
        </div>
      </div>

      {/* 娑堟伅鍒楄〃 */}
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

      {/* 杈撳叆妗?*/}
      <ChatInput
        onSendMessage={handleSendMessage}
        isFamilyStyle={isFamilyStyle}
        presetMessages={presetMessages}
      />

      {/* 閫氳瘽UI */}
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


