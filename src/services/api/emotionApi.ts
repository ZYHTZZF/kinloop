import { apiPost } from './client'
import type { EmotionAnalyzeRequest, EmotionAnalyzeResponse } from './types'

export function analyzeEmotions(payload: EmotionAnalyzeRequest) {
  return apiPost<EmotionAnalyzeResponse>('/emotions/analyze', payload)
}

