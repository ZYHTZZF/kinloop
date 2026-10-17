import { apiPost } from './client'
import type { VideoCallEmotionSummaryRequest, VideoCallEmotionSummaryResponse } from './types'

export function createVideoCallEmotionSummary(payload: VideoCallEmotionSummaryRequest) {
  return apiPost<VideoCallEmotionSummaryResponse>('/emotions/video-call-summary', payload)
}
