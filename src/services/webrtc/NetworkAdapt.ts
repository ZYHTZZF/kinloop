export type QualityLevel = 'high' | 'medium' | 'low'

export interface NetworkStats {
  packetLoss: number
  rtt: number
  bandwidth: number
  jitter: number
}

export interface VideoQualityPreset {
  level: QualityLevel
  width: number
  height: number
  frameRate: number
  bitrate: number
}

const QUALITY_PRESETS: Record<QualityLevel, VideoQualityPreset> = {
  high: { level: 'high', width: 1920, height: 1080, frameRate: 30, bitrate: 2500000 },
  medium: { level: 'medium', width: 1280, height: 720, frameRate: 24, bitrate: 1000000 },
  low: { level: 'low', width: 640, height: 360, frameRate: 15, bitrate: 300000 }
}

class NetworkAdapter {
  private qualityLevel: QualityLevel = 'high'

  analyzeStats(stats: RTCStatsReport): NetworkStats {
    let packetLoss = 0
    let rtt = 0
    let bandwidth = 100000
    let jitter = 0

    stats.forEach((report) => {
      if (report.type === 'candidate-pair') {
        const pair = report as RTCIceCandidatePairStats
        if (pair.state === 'succeeded' && typeof pair.currentRoundTripTime === 'number') {
          rtt = pair.currentRoundTripTime * 1000
        }
      }

      if (report.type === 'inbound-rtp') {
        const inbound = report as RTCReceivedRtpStreamStats
        if (inbound.kind === 'video') {
          const received = inbound.packetsReceived ?? 0
          const lost = inbound.packetsLost ?? 0
          const total = received + lost
          packetLoss = total > 0 ? lost / total : packetLoss
          jitter = typeof inbound.jitter === 'number' ? inbound.jitter : jitter
          bandwidth = Math.max(bandwidth, received * 1200)
        }
      }

      if (report.type === 'outbound-rtp') {
        const outbound = report as RTCSentRtpStreamStats
        if (outbound.kind === 'video' && typeof outbound.bytesSent === 'number') {
          bandwidth = Math.max(bandwidth, outbound.bytesSent * 8)
        }
      }
    })

    return { packetLoss, rtt, bandwidth, jitter }
  }

  getQualityLevel(stats: NetworkStats): QualityLevel {
    if (stats.packetLoss > 0.05 || stats.rtt > 300) {
      this.qualityLevel = 'low'
    } else if (stats.packetLoss > 0.02 || stats.rtt > 100) {
      this.qualityLevel = 'medium'
    } else {
      this.qualityLevel = 'high'
    }

    return this.qualityLevel
  }

  getCurrentLevel(): QualityLevel {
    return this.qualityLevel
  }

  getQualityPreset(level: QualityLevel): VideoQualityPreset {
    return QUALITY_PRESETS[level]
  }

  async applyQuality(peerConnection: RTCPeerConnection, level: QualityLevel): Promise<void> {
    const preset = QUALITY_PRESETS[level]
    const senders = peerConnection.getSenders()

    for (const sender of senders) {
      if (sender.track?.kind !== 'video') {
        continue
      }

      const params = sender.getParameters()
      params.encodings = [
        {
          ...(params.encodings?.[0] ?? {}),
          maxBitrate: preset.bitrate,
          maxFramerate: preset.frameRate,
          scaleResolutionDownBy: 1920 / preset.width
        }
      ]
      await sender.setParameters(params)
    }
  }

  reset(): void {
    this.qualityLevel = 'high'
  }
}

export const networkAdapter = new NetworkAdapter()
