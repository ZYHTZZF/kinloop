import { ICallSignal, IIceCandidate } from '../api/types'

export type CallType = 'voice' | 'video'
export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'

export interface CallConfig {
  audio?: boolean | MediaTrackConstraints
  video?: boolean | MediaTrackConstraints
  iceServers?: RTCIceServer[]
}

interface CallSession {
  callId: string
  callType: CallType
  remoteUserId: string
  peerConnection: RTCPeerConnection
  localStream: MediaStream
  remoteStream: MediaStream
  state: CallState
  startTime?: number
  endTime?: number
}

type EventCallback<T = any> = (data: T) => void

class WebRTCManager {
  private callSession: CallSession | null = null
  private signalingClient: ((signal: ICallSignal) => Promise<void>) | null = null
  private mediaDevices: MediaDeviceInfo[] = []
  private config: CallConfig
  private eventListeners: Map<string, Set<EventCallback>> = new Map()

  constructor(config?: CallConfig) {
    this.config = {
      audio: true,
      video: true,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      ...config
    }
  }

  /**
   * 设置 Signaling 客户端
   */
  setSignalingClient(client: (signal: ICallSignal) => Promise<void>): void {
    this.signalingClient = client
  }

  /**
   * 发起通话
   */
  async initiateCall(
    currentUserId: string,
    remoteUserId: string,
    callType: CallType
  ): Promise<void> {
    if (this.callSession) {
      throw new Error('Call already in progress')
    }

    const callId = `${currentUserId}-${remoteUserId}-${Date.now()}`

    try {
      // 获取本地媒体流
      const localStream = await this.requestMediaStream(callType)

      // 创建 Peer Connection
      const peerConnection = this.createPeerConnection()

      // 添加本地流轨道
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
      })

      // 创建 Remote Stream
      const remoteStream = new MediaStream()

      // 监听 Remote Track
      peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track)
        })
      }

      // 创建 Offer
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      // 存储会话
      this.callSession = {
        callId,
        callType,
        remoteUserId,
        peerConnection,
        localStream,
        remoteStream,
        state: 'ringing',
        startTime: Date.now()
      }

      // 监听 ICE candidates
      this.setupIceCandidateListener(currentUserId, remoteUserId, callId)

      // 发送 Offer 信令
      if (!this.signalingClient) {
        throw new Error('Signaling client not set')
      }

      await this.signalingClient({
        type: 'offer',
        from: currentUserId,
        to: remoteUserId,
        callId,
        callType,
        data: { sdp: offer.sdp },
        timestamp: Date.now()
      })

      this.emit('call-initiated', {
        callId,
        remoteUserId,
        callType
      })
    } catch (error) {
      this.callSession = null
      throw error
    }
  }

  /**
   * 接听通话
   */
  async acceptCall(
    currentUserId: string,
    offer: RTCSessionDescription,
    remoteUserId: string,
    callType: CallType,
    callId: string
  ): Promise<void> {
    if (this.callSession) {
      throw new Error('Call already in progress')
    }

    try {
      // 获取本地媒体流
      const localStream = await this.requestMediaStream(callType)

      // 创建 Peer Connection
      const peerConnection = this.createPeerConnection()

      // 设置远程描述
      await peerConnection.setRemoteDescription(offer)

      // 添加本地流轨道
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
      })

      // 创建 Remote Stream
      const remoteStream = new MediaStream()

      // 监听 Remote Track
      peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track)
        })
      }

      // 创建 Answer
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)

      // 存储会话
      this.callSession = {
        callId,
        callType,
        remoteUserId,
        peerConnection,
        localStream,
        remoteStream,
        state: 'connecting',
        startTime: Date.now()
      }

      // 监听 ICE candidates
      this.setupIceCandidateListener(currentUserId, remoteUserId, callId)

      // 发送 Answer 信令
      if (!this.signalingClient) {
        throw new Error('Signaling client not set')
      }

      await this.signalingClient({
        type: 'answer',
        from: currentUserId,
        to: remoteUserId,
        callId,
        data: { sdp: answer.sdp },
        timestamp: Date.now()
      })

      this.emit('call-accepted', { callId, remoteUserId })
    } catch (error) {
      this.callSession = null
      throw error
    }
  }

  /**
   * 处理远程 Answer
   */
  async handleAnswer(answer: RTCSessionDescription): Promise<void> {
    if (!this.callSession) {
      throw new Error('No call session to answer')
    }

    await this.callSession.peerConnection.setRemoteDescription(answer)
    this.callSession.state = 'connecting'
  }

  /**
   * 处理 ICE Candidate
   */
  async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.callSession) {
      console.warn('No call session to add ICE candidate')
      return
    }

    try {
      await this.callSession.peerConnection.addIceCandidate(candidate)
    } catch (error) {
      console.error('Failed to add ICE candidate:', error)
    }
  }

  /**
   * 拒接通话
   */
  async rejectCall(currentUserId: string, remoteUserId: string, callId: string): Promise<void> {
    if (this.signalingClient) {
      await this.signalingClient({
        type: 'reject',
        from: currentUserId,
        to: remoteUserId,
        callId,
        timestamp: Date.now()
      })
    }

    this.cleanup()
    this.emit('call-rejected', { callId })
  }

  /**
   * 挂断通话
   */
  hangup(): void {
    if (this.callSession) {
      this.callSession.state = 'ended'
      this.callSession.endTime = Date.now()

      this.callSession.peerConnection.close()
      this.callSession.localStream.getTracks().forEach((track) => track.stop())

      const callDuration = this.callSession.endTime - (this.callSession.startTime || 0)

      this.emit('call-ended', {
        callId: this.callSession.callId,
        duration: callDuration
      })

      this.cleanup()
    }
  }

  /**
   * 获取本地媒体流
   */
  private async requestMediaStream(callType: CallType): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: callType === 'voice' || callType === 'video' ? this.config.audio : false,
      video: callType === 'video' ? this.config.video : false
    }

    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      console.error('Failed to get media devices:', error)
      throw error
    }
  }

  /**
   * 创建 RTCPeerConnection
   */
  private createPeerConnection(): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection(
      this.config as RTCConfiguration
    )

    peerConnection.onconnectionstatechange = () => {
      if (this.callSession) {
        const state = peerConnection.connectionState
        if (state === 'connected') {
          this.callSession.state = 'connected'
          this.emit('connection-state-changed', { state: 'connected' })
        } else if (state === 'failed' || state === 'disconnected') {
          this.emit('connection-state-changed', { state: 'disconnected' })
        }
      }
    }

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState
      this.emit('ice-connection-state-changed', { state })
    }

    return peerConnection
  }

  /**
   * 设置 ICE Candidate 监听
   */
  private setupIceCandidateListener(
    currentUserId: string,
    remoteUserId: string,
    callId: string
  ): void {
    if (!this.callSession) return

    this.callSession.peerConnection.onicecandidate = async (event) => {
      if (event.candidate && this.signalingClient) {
        const candidate = event.candidate

        await this.signalingClient({
          type: 'ice-candidate',
          from: currentUserId,
          to: remoteUserId,
          callId,
          data: {
            candidate: candidate.candidate,
            sdpMLineIndex: candidate.sdpMLineIndex || 0,
            sdpMid: candidate.sdpMid || ''
          },
          timestamp: Date.now()
        })
      }
    }
  }

  /**
   * 获取连接统计（用于网络质量检测）
   */
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.callSession) return null

    try {
      return await this.callSession.peerConnection.getStats()
    } catch (error) {
      console.error('Failed to get stats:', error)
      return null
    }
  }

  /**
   * 获取本地流
   */
  getLocalStream(): MediaStream | null {
    return this.callSession?.localStream || null
  }

  /**
   * 获取远程流
   */
  getRemoteStream(): MediaStream | null {
    return this.callSession?.remoteStream || null
  }

  /**
   * 获取当前通话状态
   */
  getCallState(): CallState {
    return this.callSession?.state || 'idle'
  }

  /**
   * 切换音频
   */
  toggleAudio(enabled: boolean): void {
    if (this.callSession) {
      this.callSession.localStream
        .getAudioTracks()
        .forEach((track) => {
          track.enabled = enabled
        })
    }
  }

  /**
   * 切换视频
   */
  toggleVideo(enabled: boolean): void {
    if (this.callSession) {
      this.callSession.localStream
        .getVideoTracks()
        .forEach((track) => {
          track.enabled = enabled
        })
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.callSession = null
  }

  /**
   * 事件监听
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }

    this.eventListeners.get(event)!.add(callback)

    // 返回取消监听函数
    return () => {
      this.eventListeners.get(event)?.delete(callback)
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any): void {
    const callbacks = this.eventListeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }
}

export const webrtcManager = new WebRTCManager()
