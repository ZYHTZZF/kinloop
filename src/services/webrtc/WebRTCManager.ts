import type { ICallSignal } from '../api/types'

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

type EventCallback<T = unknown> = (data: T) => void

class WebRTCManager {
  private callSession: CallSession | null = null
  private signalingClient: ((signal: ICallSignal) => Promise<void>) | null = null
  private config: CallConfig
  private eventListeners = new Map<string, Set<EventCallback>>()

  constructor(config?: CallConfig) {
    this.config = {
      audio: true,
      video: true,
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
      ...config
    }
  }

  setSignalingClient(client: (signal: ICallSignal) => Promise<void>): void {
    this.signalingClient = client
  }

  async initiateCall(currentUserId: string, remoteUserId: string, callType: CallType): Promise<void> {
    if (this.callSession) {
      throw new Error('Call already in progress')
    }

    const callId = `${currentUserId}-${remoteUserId}-${Date.now()}`
    let localStream: MediaStream | null = null

    try {
      localStream = await this.requestMediaStream(callType)
      const peerConnection = this.createPeerConnection()
      const remoteStream = new MediaStream()

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream!)
      })

      peerConnection.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          remoteStream.addTrack(track)
        })
      }

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

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

      this.setupIceCandidateListener(currentUserId, remoteUserId, callId)
      await this.requireSignalingClient()({
        type: 'offer',
        from: currentUserId,
        to: remoteUserId,
        callId,
        callType,
        data: { sdp: offer.sdp },
        timestamp: Date.now()
      })

      this.emit('call-initiated', { callId, remoteUserId, callType })
    } catch (error) {
      localStream?.getTracks().forEach((track) => track.stop())
      this.cleanup()
      throw error
    }
  }

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

    let localStream: MediaStream | null = null

    try {
      localStream = await this.requestMediaStream(callType)
      const peerConnection = this.createPeerConnection()
      const remoteStream = new MediaStream()

      await peerConnection.setRemoteDescription(offer)

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream!)
      })

      peerConnection.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          remoteStream.addTrack(track)
        })
      }

      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)

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

      this.setupIceCandidateListener(currentUserId, remoteUserId, callId)
      await this.requireSignalingClient()({
        type: 'answer',
        from: currentUserId,
        to: remoteUserId,
        callId,
        data: { sdp: answer.sdp },
        timestamp: Date.now()
      })

      this.emit('call-accepted', { callId, remoteUserId })
    } catch (error) {
      localStream?.getTracks().forEach((track) => track.stop())
      this.cleanup()
      throw error
    }
  }

  async handleAnswer(answer: RTCSessionDescription): Promise<void> {
    if (!this.callSession) {
      throw new Error('No call session to answer')
    }

    await this.callSession.peerConnection.setRemoteDescription(answer)
    this.callSession.state = 'connecting'
  }

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

  hangup(): void {
    if (!this.callSession) {
      return
    }

    this.callSession.state = 'ended'
    this.callSession.endTime = Date.now()
    this.callSession.peerConnection.close()
    this.callSession.localStream.getTracks().forEach((track) => track.stop())
    this.callSession.remoteStream.getTracks().forEach((track) => track.stop())

    this.emit('call-ended', {
      callId: this.callSession.callId,
      duration: (this.callSession.endTime ?? Date.now()) - (this.callSession.startTime ?? Date.now())
    })

    this.cleanup()
  }

  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.callSession) {
      return null
    }

    try {
      return await this.callSession.peerConnection.getStats()
    } catch (error) {
      console.error('Failed to get stats:', error)
      return null
    }
  }

  getLocalStream(): MediaStream | null {
    return this.callSession?.localStream ?? null
  }

  getRemoteStream(): MediaStream | null {
    return this.callSession?.remoteStream ?? null
  }

  getCallState(): CallState {
    return this.callSession?.state ?? 'idle'
  }

  toggleAudio(enabled: boolean): void {
    this.callSession?.localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled
    })
  }

  toggleVideo(enabled: boolean): void {
    this.callSession?.localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled
    })
  }

  on(event: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }

    this.eventListeners.get(event)?.add(callback)

    return () => {
      this.eventListeners.get(event)?.delete(callback)
    }
  }

  private async requestMediaStream(callType: CallType): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: callType === 'voice' || callType === 'video' ? this.config.audio ?? true : false,
      video: callType === 'video' ? this.config.video ?? true : false
    }

    return navigator.mediaDevices.getUserMedia(constraints)
  }

  private createPeerConnection(): RTCPeerConnection {
    const peerConnection = new RTCPeerConnection({ iceServers: this.config.iceServers })

    peerConnection.onconnectionstatechange = () => {
      if (!this.callSession) {
        return
      }

      if (peerConnection.connectionState === 'connected') {
        this.callSession.state = 'connected'
        this.emit('connection-state-changed', { state: 'connected' })
      } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        this.emit('connection-state-changed', { state: 'disconnected' })
      }
    }

    peerConnection.oniceconnectionstatechange = () => {
      this.emit('ice-connection-state-changed', { state: peerConnection.iceConnectionState })
    }

    return peerConnection
  }

  private setupIceCandidateListener(currentUserId: string, remoteUserId: string, callId: string): void {
    if (!this.callSession || !this.signalingClient) {
      return
    }

    this.callSession.peerConnection.onicecandidate = async (event) => {
      if (!event.candidate || !this.signalingClient) {
        return
      }

      await this.signalingClient({
        type: 'ice-candidate',
        from: currentUserId,
        to: remoteUserId,
        callId,
        data: {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex ?? 0,
          sdpMid: event.candidate.sdpMid ?? ''
        },
        timestamp: Date.now()
      })
    }
  }

  private requireSignalingClient(): (signal: ICallSignal) => Promise<void> {
    if (!this.signalingClient) {
      throw new Error('Signaling client not set')
    }

    return this.signalingClient
  }

  private cleanup(): void {
    this.callSession = null
  }

  private emit(event: string, data: unknown): void {
    this.eventListeners.get(event)?.forEach((callback) => callback(data))
  }
}

export const webrtcManager = new WebRTCManager()
