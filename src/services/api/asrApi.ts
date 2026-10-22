import { buildApiUrl } from '../../platform/apiConfig'
import { createApiHeaders } from './client'

interface AsrTranscriptionResponse {
  ok: boolean
  text: string
  provider?: string
}

export async function transcribeRecordedAudio(audioBlob: Blob) {
  const audioBase64 = await blobToBase64(audioBlob)
  const response = await fetch(buildApiUrl('/asr/transcribe'), {
    method: 'POST',
    headers: createApiHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      audioBase64,
      mimeType: audioBlob.type || 'audio/wav',
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : `ASR request failed: ${response.status}`,
    )
  }

  return response.json() as Promise<AsrTranscriptionResponse>
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return window.btoa(binary)
}
