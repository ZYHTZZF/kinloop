import React, { useEffect, useState } from 'react'
import { formatCallDuration } from '../../utils/webrtc'
import FloatingCallWindow from './FloatingCallWindow'
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
}) => {
  const [isSpeaker, setIsSpeaker] = useState(false)
  const [displayDuration, setDisplayDuration] = useState(0)

  useEffect(() => {
    if (callState !== 'connected') return
    const interval = setInterval(() => {
      setDisplayDuration((prev) => prev + 1000)
    }, 1000)
    return () => clearInterval(interval)
  }, [callState])

  useEffect(() => {
    setDisplayDuration(duration)
  }, [duration])

  if (callState === 'idle' || callState === 'ended') return null

  const statusText =
    callState === 'ringing'
      ? isIncoming
        ? '来电中'
        : '呼叫中'
      : callState === 'connecting'
        ? '连接中'
        : '通话中'

  const handleToggleSpeaker = () => {
    const next = !isSpeaker
    setIsSpeaker(next)
    onToggleSpeaker?.(next)
  }

  return (
    <FloatingCallWindow title={`${remoteUser.name} · 语音通话`} status={statusText} width={320}>
      <div className={styles.wrap}>
        <div className={styles.identity}>
          {remoteUser.avatar ? <img src={remoteUser.avatar} alt={remoteUser.name} className={styles.avatar} /> : null}
          <div>
            <p className={styles.name}>{remoteUser.name}</p>
            <p className={styles.duration}>{formatCallDuration(displayDuration)}</p>
          </div>
        </div>

        {isIncoming && (callState === 'ringing' || callState === 'connecting') ? (
          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.reject}`} onClick={onReject} title="拒接">
              拒接
            </button>
            <button className={`${styles.btn} ${styles.accept}`} onClick={onAccept} title="接听">
              接听
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button
              className={`${styles.btn} ${styles.mute} ${isMuted ? styles.active : ''}`}
              onClick={() => onToggleMute(!isMuted)}
              title={isMuted ? '开麦' : '静音'}
            >
              {isMuted ? '开麦' : '静音'}
            </button>

            {onToggleSpeaker ? (
              <button className={`${styles.btn} ${styles.mute}`} onClick={handleToggleSpeaker} title="扬声器">
                {isSpeaker ? '听筒' : '扬声器'}
              </button>
            ) : null}

            <button className={`${styles.btn} ${styles.reject}`} onClick={onHangup} title="挂断">
              挂断
            </button>
          </div>
        )}
      </div>
    </FloatingCallWindow>
  )
}

export default VoiceCall
