export type EchoTabType = 'family' | 'memory'

export type FamilyEchoStatus = 'new' | 'viewed' | 'replied'
export type MemoryEchoStatus = 'can_continue' | 'snoozed'

export type FamilyEchoAction = 'listen' | 'quick_reply' | 'continue_talk'
export type MemoryEchoAction = 'continue_talk' | 'snooze_memory'

export type EchoQuickReplyOption = {
  id: string
  label: string
}

type EchoCardBase = {
  id: string
  source: string
  time: string
  detail: string
}

export type FamilyEchoCardVM = EchoCardBase & {
  tab: 'family'
  title: string
  summary: string
  status: FamilyEchoStatus
  primaryAction: FamilyEchoAction
  secondaryActions: FamilyEchoAction[]
}

export type MemoryEchoCardVM = EchoCardBase & {
  tab: 'memory'
  topic: string
  promptText: string
  status: MemoryEchoStatus
  primaryAction: MemoryEchoAction
  secondaryActions: MemoryEchoAction[]
}

export type EchoItem = {
  source: string
  title: string
  detail: string
}

export type EchoSessionStatus = 'new' | 'viewed' | 'replied'

export type EchoContextBlock = {
  lead: string
  quote: string
  time: string
}

export type EchoMemorySnippet = {
  tag: string
  text: string
  photoHint?: string
}

export type EchoSessionVM = {
  id: string
  familyName: string
  source: string
  time: string
  greetingMeta?: string
  echoBody: string
  voiceTranscription?: string
  inputHint: string
  context: EchoContextBlock
  memorySnippet?: EchoMemorySnippet
  status: EchoSessionStatus
  canContinue: boolean
  snoozed: boolean
  latest: boolean
}

export type EchoGreeting = {
  salutation: string
  guidance: string
}
