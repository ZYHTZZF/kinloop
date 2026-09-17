export type QualityLevel = 'high' | 'medium' | 'low'

export interface NetworkStats {
  packetLoss: number // 0-1
  rtt: number // ms
  bandwidth: number // bps
  jitter: number // ms
}

export interface VideoQualityPreset {
  level: QualityLevel
  width: number
  height: number
  frameRate: number
  bitrate: number
}

const QUALITY_PRESETS: Record<QualityLevel, VideoQualityPreset> = {
  high: {
    level: 'high',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrate: 2500000 // 2.5 Mbps
  },
  medium: {
    level: 'medium',
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrate: 1000000 // 1 Mbps
  },
  low: {
    level: 'low',
    width: 640,
    height: 360,
    frameRate: 15,
    bitrate: 300000 // 300 Kbps
  }
}

class NetworkAdapter {
  private previousStats: Map<string, RTCSentRtpStreamStats | RTCRecvRtpStreamStats> = new Map()
  private qualityLevel: QualityLevel = 'high'

  /**
   * 分析网络统计信息
   */
  analyzeStats(stats: RTCStatsReport): NetworkStats {
    let packetLoss = 0
    let rtt = 0
    let bandwidth = 1000000000 // 初始值：假设无限带宽
    let jitter = 0
    let statCount = 0

    stats.forEach((report) => {
      // 处理发送流统计
      if (
        report.type === 'inbound-rtp' &&
        (report as RTCRecvRtpStreamStats).kind === 'video'
      ) {
        const inboundStats = report as RTCRecvRtpStreamStats
        const previousStats = this.previousStats.get(report.id)

        if (previousStats && 'bytesReceived' in previousStats) {
          const prev = previousStats as RTCRecvRtpStreamStats
          const bytesDelta =
            (inboundStats.bytesReceived || 0) - (prev.bytesReceived || 0)
          const timeDelta =
            ((inboundStats.timestamp as number) - (prev.timestamp as number)) /
            1000 // Convert to seconds

          if (timeDelta > 0) {
            const bitrate = (bytesDelta * 8) / timeDelta
            bandwidth = Math.min(bandwidth, bitrate)
          }
        }

        // 计算丢包率
        const totalRtcp =
          (inboundStats.packetsLost || 0) + (inboundStats.packetsReceived || 0)
        if (totalRtcp > 0) {
          packetLoss =
            (inboundStats.packetsLost || 0) / totalRtcp
        }

        // 获取 jitter
        jitter = inboundStats.jitter || 0

        this.previousStats.set(report.id, inboundStats)
        statCount++
      }

      // 处理接收流统计
      if (
        report.type === 'outbound-rtp' &&
        (report as RTCRecvRtpStreamStats).kind === 'video'
      ) {
        const outboundStats = report as RTCSentRtpStreamStats
        const previousStats = this.previousStats.get(report.id)

        if (previousStats && 'bytesSent' in previousStats) {
          const prev = previousStats as RTCSentRtpStreamStats
          const bytesDelta =
            (outboundStats.bytesSent || 0) - (prev.bytesSent || 0)
          const timeDelta =
            ((outboundStats.timestamp as number) -
              (prev.timestamp as number)) /
            1000

          if (timeDelta > 0) {
            const bitrate = (bytesDelta * 8) / timeDelta
            bandwidth = Math.min(bandwidth, bitrate)
          }
        }

        this.previousStats.set(report.id, outboundStats)
        statCount++
      }

      // 获取 RTT
      if (report.type === 'candidate-pair' && (report as RTCIceCandidatePairStats).state === 'succeeded') {
        rtt = (report as RTCIceCandidatePairStats).currentRoundTripTime * 1000 || 0
      }
    })

    return {
      packetLoss,
      rtt,
      bandwidth: Math.max(bandwidth, 100000), // 最小 100Kbps
      jitter
    }
  }

  /**
   * 根据网络统计信息判断质量等级
   */
  getQualityLevel(stats: NetworkStats): QualityLevel {
    const { packetLoss, rtt } = stats

    // 丢包率 > 5% 或延迟 > 300ms → 低质量
    if (packetLoss > 0.05 || rtt > 300) {
      this.qualityLevel = 'low'
    }
    // 丢包率 2-5% 或延迟 100-300ms → 中质量
    else if (packetLoss > 0.02 || rtt > 100) {
      this.qualityLevel = 'medium'
    }
    // 丢包率 < 2% 且延迟 < 100ms → 高质量
    else {
      this.qualityLevel = 'high'
    }

    return this.qualityLevel
  }

  /**
   * 获取当前质量等级
   */
  getCurrentLevel(): QualityLevel {
    return this.qualityLevel;
  }

  /**
   * 获取质量预设
   */
  getQualityPreset(level: QualityLevel): VideoQualityPreset {
    return QUALITY_PRESETS[level]
  }

  /**
   * 应用质量设置到 RTCPeerConnection
   */
  async applyQuality(
    peerConnection: RTCPeerConnection,
    level: QualityLevel
  ): Promise<void> {
    const preset = QUALITY_PRESETS[level]

    try {
      const senders = await peerConnection.getSenders()

      for (const sender of senders) {
        if (sender.track?.kind === 'video') {
          const params = sender.getParameters()

          // 更新编码参数
          if (params.encodings) {
            params.encodings[0] = {
              ...params.encodings[0],
              maxBitrate: preset.bitrate,
              maxFramerate: preset.frameRate,
              scaleResolutionDownBy: this.calculateScaleResolution(preset)
            }
          }

          await sender.setParameters(params)
        }
      }

      console.log(`[NetworkAdapter] Applied ${level} quality preset`, preset)
    } catch (error) {
      console.error('[NetworkAdapter] Failed to apply quality:', error)
    }
  }

  /**
   * 计算分辨率缩放因子
   */
  private calculateScaleResolution(preset: VideoQualityPreset): number {
    // 假设基准分辨率是 1920x1080
    const baseWidth = 1920
    const scale = baseWidth / preset.width
    return scale
  }

  /**
   * 重置统计信息
   */
  reset(): void {
    this.previousStats.clear()
    this.qualityLevel = 'high'
  }
}

export const networkAdapter = new NetworkAdapter()
