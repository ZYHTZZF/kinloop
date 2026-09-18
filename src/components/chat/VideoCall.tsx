import React, { useEffect, useRef, useState } from 'react'
import { formatCallDuration } from '../../utils/webrtc'
import styles from './VideoCall.module.css'

interface VideoCallProps {
  remoteUser: { id: string; name: string; avatar?: string }
  remoteStream: MediaStream | null
  localStream: MediaStream | null
  callState: 'ringing' | 'connecting' | 'connected' | 'ended'
  duration: number
  isIncoming: boolean
  isMuted: boolean
  isCameraOn: boolean
  onAccept: () => void
  onReject: () => void
  onHangup: () => void
  onToggleMute: (isMuted: boolean) => void
  onToggleCamera: (isCameraOn: boolean) => void
  onSwitchDevice?: () => void
  isFamilyStyle?: boolean
}

const VideoCall: React.FC<VideoCallProps> = ({
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
  onToggleCamera,
  onSwitchDevice,
  isFamilyStyle = false
}) => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [displayDuration, setDisplayDuration] = useState(0)

  // 处理远程视频流
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  // 处理本地视频流
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.muted = true
    }
  }, [localStream])

  // 更新通话时长
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
              {callState === 'ringing' ? '来视频通话...' : '连接中...'}
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
              📹
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Connected 视频通话界面
  if (callState === 'connected' || callState === 'connecting') {
    return (
      <div className={containerClasses}>
        <div className={styles.videoContainer}>
          {/* 远程视频（主显示） */}
          <video
            ref={remoteVideoRef}
            className={styles.remoteVideo}
            autoPlay
            playsInline
          />

          {/* 本地视频（小窗） */}
          <div className={styles.localVideoWrapper}>
            <video
              ref={localVideoRef}
              className={styles.localVideo}
              autoPlay
              playsInline
              muted
            />
          </div>

          {/* 控制栏 */}
          <div className={styles.controlBar}>
            <div className={styles.callInfo}>
              <h3 className={styles.callerName}>{remoteUser.name}</h3>
              <p className={styles.duration}>
                {formatCallDuration(displayDuration)}
              </p>
            </div>

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

              <button
                className={`${styles.controlButton} ${
                  !isCameraOn ? styles.active : ''
                }`}
                onClick={() => onToggleCamera(!isCameraOn)}
                title={isCameraOn ? '关闭摄像头' : '打开摄像头'}
              >
                {isCameraOn ? '📹' : '📵'}
              </button>

              {onSwitchDevice && (
                <button
                  className={styles.controlButton}
                  onClick={onSwitchDevice}
                  title="切换摄像头"
                >
                  🔄
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
      </div>
    )
  }

  return null
}

export default VideoCall
