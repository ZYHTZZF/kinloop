import { buildApiUrl } from '../../platform/apiConfig'
import { createApiHeaders } from './client'

interface TtsSynthesisResponse {
  audioBase64: string
  mimeType: string
  provider: string
  voiceType: string
}

export async function synthesizeSpeech(text: string, voiceType?: string) {
  const response = await fetch(buildApiUrl('/tts/synthesize'), {
    method: 'POST',
    headers: createApiHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      text,
      voiceType,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : `TTS request failed: ${response.status}`,
    )
  }

  return response.json() as Promise<TtsSynthesisResponse>
}
