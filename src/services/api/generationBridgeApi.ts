import { apiPost } from './client'
import type { GenerationBridgeExplainRequest, GenerationBridgeExplainResponse } from './types'

export function explainGenerationBridge(payload: GenerationBridgeExplainRequest) {
  return apiPost<GenerationBridgeExplainResponse>('/ai/generation-bridge/explain', payload)
}
