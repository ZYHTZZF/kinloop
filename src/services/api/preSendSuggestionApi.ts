import { apiPost } from './client'
import type { PreSendSuggestionRequest, PreSendSuggestionResponse } from './types'

export function getPreSendSuggestion(payload: PreSendSuggestionRequest) {
  return apiPost<PreSendSuggestionResponse>('/ai/pre-send-suggestions', payload)
}
