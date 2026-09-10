export type SupportChannel = 'family' | 'neighbor' | 'service' | 'emergency'

export type EscalationStage = 'triaged' | 'contacting' | 'scheduled' | 'resolved'

export type HelpAction = {
  label: string
  tone: 'default' | 'primary'
  description: string
}

export type HelpRequestRecord = {
  id: string
  title: string
  summary: string
  originalText?: string
  requester: string
  channel: SupportChannel
  stage: EscalationStage
  responseGoal: string
  lastUpdate: string
}

export type EscalationStep = {
  label: string
  detail: string
}
