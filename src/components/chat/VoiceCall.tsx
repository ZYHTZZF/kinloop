import { useEffect, useMemo, useState } from 'react'
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
}

export default function VoiceCall({
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
}: VoiceCallProps) {
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [displayDuration, setDisplayDuration] = useState(0)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    setDisplayDuration(duration)
  }, [duration])

  useEffect(() => {
    if (callState !== 'connected') return undefined
    const interval = window.setInterval(() => {
      setDisplayDuration((prev) => prev + 1000)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [callState])

  useEffect(() => {
    if (callState === 'ended' || callState === 'idle') {
      setIsMinimized(false)
    }
  }, [callState])

  const statusLabel = useMemo(() => {
    if (isIncoming && callState === 'ringing') return '语音来电'
    if (callState === 'ringing') return '正在呼叫...'
    if (callState === 'connecting') return '正在接通...'
    if (callState === 'connected') return formatCallDuration(displayDuration)
    return ''
  }, [callState, displayDuration, isIncoming])

  const avatarFallback = remoteUser.name.slice(0, 1) || '家'

  if (callState === 'idle' || callState === 'ended') {
    return null
  }

  if (isMinimized) {
    return (
      <button
        className={styles.minimizedCard}
        type="button"
        onClick={() => setIsMinimized(false)}
        aria-label={`重新打开和${remoteUser.name}的语音通话`}
      >
        {remoteUser.avatar ? (
          <img className={styles.minimizedAvatar} src={remoteUser.avatar} alt={remoteUser.name} />
        ) : (
          <span className={styles.minimizedAvatarFallback}>{avatarFallback}</span>
        )}
        <span className={styles.minimizedName}>{remoteUser.name}</span>
      </button>
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.sheet}>
        <button
          className={styles.minimizeButton}
          type="button"
          onClick={() => setIsMinimized(true)}
          aria-label="最小化通话窗口"
        >
          _
        </button>

        <div className={styles.header}>
          <h2>{remoteUser.name}</h2>
          <p>{statusLabel}</p>
        </div>

        {remoteUser.avatar ? (
          <img className={styles.avatar} src={remoteUser.avatar} alt={remoteUser.name} />
        ) : (
          <div className={styles.avatarFallback}>{avatarFallback}</div>
        )}

        {isIncoming && callState === 'ringing' ? (
          <div className={styles.incomingActions}>
            <button className={`${styles.actionButton} ${styles.rejectButton}`} type="button" onClick={onReject}>
              挂断
            </button>
            <button className={`${styles.actionButton} ${styles.acceptButton}`} type="button" onClick={onAccept}>
              接听
            </button>
          </div>
        ) : (
          <div className={styles.bottomControls}>
            <button
              className={`${styles.controlButton} ${isMuted ? styles.controlButtonActive : ''}`}
              type="button"
              onClick={() => onToggleMute(!isMuted)}
            >
              {isMuted ? '开麦' : '静音'}
            </button>
            <button className={`${styles.controlButton} ${styles.hangupButton}`} type="button" onClick={onHangup}>
              挂断
            </button>
            <button
              className={`${styles.controlButton} ${isSpeakerOn ? styles.controlButtonActive : ''}`}
              type="button"
              onClick={() => {
                const next = !isSpeakerOn
                setIsSpeakerOn(next)
                onToggleSpeaker?.(next)
              }}
            >
              免提
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
