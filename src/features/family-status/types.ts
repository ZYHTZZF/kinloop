export type RecentStatusLevel = 'reminder' | 'attention' | 'priority'
export type RecentProcessState = 'todo' | 'doing' | 'done'
export type SuggestedAction = 'voice' | 'call' | 'visit'

export type RecentStatusCardVM = {
  id: string
  time: string
  level: RecentStatusLevel
  title: string
  description: string
  reason: string
  suggestedAction: SuggestedAction
  processState: RecentProcessState
  evidence: string[]
}

export type StatusItem = {
  time: string
  title: string
  detail: string
}

export type EvidenceBlockType = 'photo' | 'quote' | 'data'

export type EvidenceBlock = {
  id: string
  type: EvidenceBlockType
  title: string
  content: string
}

export type DecisionSessionVM = {
  id: string
  tier: RecentStatusLevel
  processState: RecentProcessState
  time: string
  insightTag: string
  insightText: string
  actionType: SuggestedAction
  contactName: string
  actionLabel: string
  actionDoneText: string
  secondaryPrompt?: string
  evidence: EvidenceBlock[]
}
