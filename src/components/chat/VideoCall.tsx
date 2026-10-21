import { useEffect, useRef, useState } from 'react'
import { formatCallDuration } from '../../utils/webrtc'
import styles from './VideoCall.module.css'

interface VideoCallProps {
  remoteUser: { id: string; name: string; avatar?: string }
  remoteStream: MediaStream | null
  localStream: MediaStream | null
  callState: 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'
  duration: number
  isIncoming: boolean
  isMuted: boolean
  isCameraOn: boolean
  onAccept: () => void
  onReject: () => void
  onHangup: () => void
  onToggleMute: (isMuted: boolean) => void
  onToggleCamera: (isCameraOn: boolean) => void
  onToggleSpeaker?: (isEnabled: boolean) => void
}

export default function VideoCall({
  remoteUser,
  remoteStream,
  localStream,
  callState,
  duration,
  isIncoming,
  isMuted,
  isCameraOn,
  onAccept,
  onReject,
  onHangup,
  onToggleMute,
  onToggleSpeaker,
}: VideoCallProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [displayDuration, setDisplayDuration] = useState(0)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.muted = true
    }
  }, [localStream])

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

  const avatarFallback = remoteUser.name.slice(0, 1) || '家'
  const statusLabel =
    isIncoming && callState === 'ringing'
      ? '视频来电'
      : callState === 'ringing'
        ? '正在呼叫...'
        : callState === 'connecting'
          ? '正在接通...'
          : formatCallDuration(displayDuration)

  if (callState === 'idle' || callState === 'ended') {
    return null
  }

  if (isMinimized) {
    return (
      <button
        className={styles.minimizedCard}
        type="button"
        onClick={() => setIsMinimized(false)}
        aria-label={`重新打开和${remoteUser.name}的视频通话`}
      >
        {remoteUser.avatar ? (
          <img className={styles.minimizedAvatar} src={remoteUser.avatar} alt={remoteUser.name} />
        ) : (
          <span className={styles.minimizedAvatarFallback}>{avatarFallback}</span>
        )}
      </button>
    )
  }

  if (isIncoming && callState === 'ringing') {
    return (
      <div className={styles.overlay}>
        <div className={styles.incomingSheet}>
          <button
            className={styles.minimizeButton}
            type="button"
            onClick={() => setIsMinimized(true)}
            aria-label="最小化通话窗口"
          >
            _
          </button>
          {remoteUser.avatar ? (
            <img className={styles.incomingAvatar} src={remoteUser.avatar} alt={remoteUser.name} />
          ) : (
            <div className={styles.incomingAvatarFallback}>{avatarFallback}</div>
          )}
          <div className={styles.incomingHeader}>
            <h2>{remoteUser.name}</h2>
            <p>视频来电</p>
          </div>
          <div className={styles.incomingActions}>
            <button className={`${styles.actionButton} ${styles.rejectButton}`} type="button" onClick={onReject}>
              挂断
            </button>
            <button className={`${styles.actionButton} ${styles.acceptButton}`} type="button" onClick={onAccept}>
              接听
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.videoShell}>
        <video ref={remoteVideoRef} className={styles.remoteVideo} autoPlay playsInline />

        <button
          className={styles.minimizeButton}
          type="button"
          onClick={() => setIsMinimized(true)}
          aria-label="最小化通话窗口"
        >
          _
        </button>

        <div className={styles.topInfo}>
          <h2>{remoteUser.name}</h2>
          <p>{statusLabel}</p>
        </div>

        <div className={styles.localPreview}>
          {localStream && isCameraOn ? (
            <video ref={localVideoRef} className={styles.localVideo} autoPlay playsInline muted />
          ) : remoteUser.avatar ? (
            <img className={styles.localAvatarFallbackImage} src={remoteUser.avatar} alt={remoteUser.name} />
          ) : (
            <div className={styles.localAvatarFallback}>{avatarFallback}</div>
          )}
        </div>

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
      </div>
    </div>
  )
}
