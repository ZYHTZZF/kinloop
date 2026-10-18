import type { ConversationCard, Member } from './types'
import type { ElderVoiceIntentResult } from '../../domain/elderVoice'
import { buildApiUrl } from '../../platform/apiConfig'

type AiIntentResponse = {
  ok: boolean
  result: ElderVoiceIntentResult
}

export async function inferElderIntent(
  spokenText: string,
  members: Member[],
  conversations: ConversationCard[],
): Promise<ElderVoiceIntentResult> {
  const response = await fetch(buildApiUrl('/ai/elder-intent'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spokenText,
      members,
      conversations,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'AI intent request failed' }))
    throw new Error(String(payload?.error ?? 'AI intent request failed'))
  }

  const payload = await response.json() as AiIntentResponse
  return payload.result
}
