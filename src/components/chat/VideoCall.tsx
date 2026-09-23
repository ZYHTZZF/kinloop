import React, { useEffect, useRef, useState } from 'react'
import { formatCallDuration } from '../../utils/webrtc'
import FloatingCallWindow from './FloatingCallWindow'
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
}) => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const [displayDuration, setDisplayDuration] = useState(0)

  // Demo phase: if no remote stream, mirror local camera for "other side".
  const demoRemoteStream = remoteStream ?? localStream

  useEffect(() => {
    if (remoteVideoRef.current && demoRemoteStream) {
      remoteVideoRef.current.srcObject = demoRemoteStream
    }
  }, [demoRemoteStream])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.muted = true
    }
  }, [localStream])

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
        ? '视频来电'
        : '发起视频中'
      : callState === 'connecting'
        ? '视频连接中'
        : `视频通话中 · ${formatCallDuration(displayDuration)}`

  return (
    <FloatingCallWindow title={`${remoteUser.name} · 视频通话`} status={statusText} width={380}>
      <div className={styles.wrap}>
        <div className={styles.stage}>
          <video ref={remoteVideoRef} className={styles.remoteVideo} autoPlay playsInline />
          <span className={styles.label}>对方（演示）</span>

          <div className={styles.localWrap}>
            <video ref={localVideoRef} className={styles.localVideo} autoPlay playsInline muted />
            <span className={`${styles.label} ${styles.localLabel}`}>我</span>
          </div>
        </div>

        {isIncoming && (callState === 'ringing' || callState === 'connecting') ? (
          <div className={styles.controls}>
            <button className={`${styles.btn} ${styles.danger}`} onClick={onReject} title="拒接">
              拒接
            </button>
            <button className={`${styles.btn} ${styles.accept}`} onClick={onAccept} title="接听">
              接听
            </button>
          </div>
        ) : (
          <div className={styles.controls}>
            <button
              className={`${styles.btn} ${styles.normal} ${isMuted ? styles.active : ''}`}
              onClick={() => onToggleMute(!isMuted)}
              title={isMuted ? '开麦' : '静音'}
            >
              {isMuted ? '开麦' : '静音'}
            </button>
            <button
              className={`${styles.btn} ${styles.normal} ${!isCameraOn ? styles.active : ''}`}
              onClick={() => onToggleCamera(!isCameraOn)}
              title={isCameraOn ? '关摄像头' : '开摄像头'}
            >
              {isCameraOn ? '关摄像头' : '开摄像头'}
            </button>
            {onSwitchDevice ? (
              <button className={`${styles.btn} ${styles.normal}`} onClick={onSwitchDevice} title="切换设备">
                切换
              </button>
            ) : null}
            <button className={`${styles.btn} ${styles.danger}`} onClick={onHangup} title="挂断">
              挂断
            </button>
          </div>
        )}
      </div>
    </FloatingCallWindow>
  )
}

export default VideoCall
