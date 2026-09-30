import React, { useEffect, useState } from 'react'
import { formatCallDuration } from '../../utils/webrtc'
import styles from './VoiceCall.module.css'

interface VoiceCallProps {
  remoteUser: { id: string; name: string; avatar?: string }
  callState: 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'
  duration: number
  isIncoming: boolean
  isMuted: boolean
  onAccept: () => void
  onReject: () => void
  onHangup: () => void
  onToggleMute: (isMuted: boolean) => void
  onToggleSpeaker?: (isEnabled: boolean) => void
  isFamilyStyle?: boolean
}

const VoiceCall: React.FC<VoiceCallProps> = ({
  remoteUser,
  callState,
  duration,
  isIncoming,
  isMuted,
  onAccept,
  onReject,
  onHangup,
  onToggleMute,
  onToggleSpeaker,
  isFamilyStyle = false
}) => {
  const [isSpeaker, setIsSpeaker] = useState(false)
  const [displayDuration, setDisplayDuration] = useState(0)

  useEffect(() => {
    if (callState === 'connected') {
      const interval = setInterval(() => {
        setDisplayDuration((prev) => prev + 1000)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [callState])

  useEffect(() => {
    setDisplayDuration(duration)
  }, [duration])

  const handleToggleSpeaker = () => {
    const newState = !isSpeaker
    setIsSpeaker(newState)
    if (onToggleSpeaker) {
      onToggleSpeaker(newState)
    }
  }

  const containerClasses = [
    styles.container,
    isFamilyStyle ? styles.familyStyle : styles.normalStyle,
    callState === 'ended' ? styles.hidden : ''
  ]
    .filter(Boolean)
    .join(' ')

  // Incoming call 界面
  if (isIncoming && (callState === 'ringing' || callState === 'connecting')) {
    return (
      <div className={containerClasses}>
        <div className={styles.content}>
          <div className={styles.incomingHeader}>
            {callState === 'ringing' && <div className={styles.ringingAnimation} />}
            <h2 className={styles.callerName}>{remoteUser.name}</h2>
            <p className={styles.status}>
              {callState === 'ringing' ? '来电中...' : '连接中...'}
            </p>
          </div>

          {remoteUser.avatar && (
            <img
              src={remoteUser.avatar}
              alt={remoteUser.name}
              className={styles.avatar}
            />
          )}

          <div className={styles.incomingActions}>
            <button
              className={styles.rejectButton}
              onClick={onReject}
              title="拒接"
            >
              ❌
            </button>
            <button
              className={styles.acceptButton}
              onClick={onAccept}
              title="接听"
            >
              📞
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Connected 通话界面
  if (callState === 'connected' || callState === 'connecting') {
    return (
      <div className={containerClasses}>
        <div className={styles.content}>
          <div className={styles.callHeader}>
            <h2 className={styles.callerName}>{remoteUser.name}</h2>
            <p className={styles.duration}>
              {formatCallDuration(displayDuration)}
            </p>
          </div>

          {remoteUser.avatar && (
            <img
              src={remoteUser.avatar}
              alt={remoteUser.name}
              className={styles.largeAvatar}
            />
          )}

          <div className={styles.controls}>
            <button
              className={`${styles.controlButton} ${
                isMuted ? styles.active : ''
              }`}
              onClick={() => onToggleMute(!isMuted)}
              title={isMuted ? '打开麦克风' : '切静音'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {onToggleSpeaker && (
              <button
                className={`${styles.controlButton} ${
                  isSpeaker ? styles.active : ''
                }`}
                onClick={handleToggleSpeaker}
                title={isSpeaker ? '关闭扬声器' : '扬声器'}
              >
                {isSpeaker ? '📢' : '📞'}
              </button>
            )}

            <button
              className={styles.hangupButton}
              onClick={onHangup}
              title="挂断"
            >
              ❌
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default VoiceCall
