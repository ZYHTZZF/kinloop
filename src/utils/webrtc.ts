/**
 * WebRTC 相关的工具函数
 */

/**
 * 获取用户媒体流（摄像头/麦克风）
 */
export async function getLocalStream(
  audio: boolean | MediaTrackConstraints = true,
  video: boolean | MediaTrackConstraints = true
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio,
      video
    })
  } catch (error) {
    console.error('Failed to get media stream:', error)
    throw error
  }
}

/**
 * 停止媒体流的所有轨道
 */
export function stopLocalStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => {
    track.stop()
  })
}

/**
 * 获取可用的媒体设备
 */
export async function getAvailableDevices(): Promise<MediaDeviceInfo[]> {
  try {
    return await navigator.mediaDevices.enumerateDevices()
  } catch (error) {
    console.error('Failed to enumerate devices:', error)
    return []
  }
}

/**
 * 获取指定类型的设备
 */
export async function getDevices(
  kind?: 'audioInput' | 'audioOutput' | 'videoinput'
): Promise<MediaDeviceInfo[]> {
  const devices = await getAvailableDevices()

  if (kind) {
    return devices.filter((device) => device.kind === kind)
  }

  return devices
}

/**
 * 设置音频输出设备
 */
export async function setAudioOutputDevice(
  deviceId: string,
  audioElement: HTMLAudioElement
): Promise<void> {
  if (!audioElement.setSinkId) {
    console.warn('setSinkId not supported in this browser')
    return
  }

  try {
    await audioElement.setSinkId(deviceId)
    console.log(`Audio output device set to ${deviceId}`)
  } catch (error) {
    console.error(`Failed to set audio output device:`, error)
  }
}

/**
 * 请求摄像头权限
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch (error) {
    console.error('Camera permission denied:', error)
    return false
  }
}

/**
 * 请求麦克风权限
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch (error) {
    console.error('Microphone permission denied:', error)
    return false
  }
}

/**
 * 检查浏览器 WebRTC 支持
 */
export function isWebRTCSupported(): boolean {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.RTCPeerConnection
  )
}

/**
 * 检查浏览器是否支持特定的编解码器
 */
export function isCodecSupported(codec: string): boolean {
  const pc = new RTCPeerConnection()
  const offer = pc.createOffer()

  if (offer.then) {
    return offer
      .then((offer) => {
        const sdp = offer.sdp || ''
        pc.close()
        return sdp.includes(codec)
      })
      .catch(() => {
        pc.close()
        return false
      })
  }

  return false
}

/**
 * 获取视频轨道的设置
 */
export function getVideoTrackSettings(stream: MediaStream): MediaTrackSettings | null {
  const videoTrack = stream.getVideoTracks()[0]

  if (!videoTrack) {
    return null
  }

  return videoTrack.getSettings()
}

/**
 * 获取音频轨道的设置
 */
export function getAudioTrackSettings(stream: MediaStream): MediaTrackSettings | null {
  const audioTrack = stream.getAudioTracks()[0]

  if (!audioTrack) {
    return null
  }

  return audioTrack.getSettings()
}

/**
 * 监听设备变更事件
 */
export function onDeviceChange(callback: (devices: MediaDeviceInfo[]) => void): () => void {
  const handler = async () => {
    const devices = await getAvailableDevices()
    callback(devices)
  }

  navigator.mediaDevices.addEventListener('devicechange', handler)

  // 返回移除监听的函数
  return () => {
    navigator.mediaDevices.removeEventListener('devicechange', handler)
  }
}

/**
 * 获取本地 IP 地址（用于测试）
 */
export async function getLocalIp(): Promise<string | null> {
  try {
    const pc = new RTCPeerConnection({ iceServers: [] })
    const offer = await pc.createOffer()
    const sdp = offer.sdp

    const ipRegex = /a=candidate:.*?([\d.]+)/
    const match = sdp.match(ipRegex)

    pc.close()

    return match ? match[1] : null
  } catch (error) {
    console.error('Failed to get local IP:', error)
    return null
  }
}

/**
 * 生成通话 ID
 */
export function generateCallId(userId1: string, userId2: string): string {
  return `${userId1}-${userId2}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * 格式化通话时长
 */
export function formatCallDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
