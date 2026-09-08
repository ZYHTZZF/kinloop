import type { RecentStatusCardVM } from '../../types'

// Adapter placeholder: future follow-up contract -> recent status VM.
export function mapFollowupToStatus(input: {
  id: string
  time: string
  level: 'reminder' | 'attention' | 'priority'
  title: string
  description: string
  reason: string
  suggestedAction: 'voice' | 'call' | 'visit'
  evidence: string[]
}): RecentStatusCardVM {
  return {
    id: input.id,
    time: input.time,
    level: input.level,
    title: input.title,
    description: input.description,
    reason: input.reason,
    suggestedAction: input.suggestedAction,
    processState: 'todo',
    evidence: input.evidence,
  }
}
