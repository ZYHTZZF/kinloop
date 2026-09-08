import type { FamilyEchoCardVM, MemoryEchoCardVM } from '../../types'

// Adapter placeholder: future shared contract -> elder echo VM.
export function mapConversationToEcho(input: {
  id: string
  source: string
  time: string
  title: string
  summary: string
  detail: string
}): FamilyEchoCardVM {
  return {
    id: input.id,
    tab: 'family',
    source: input.source,
    time: input.time,
    title: input.title,
    summary: input.summary,
    detail: input.detail,
    status: 'new',
    primaryAction: 'quick_reply',
    secondaryActions: ['listen', 'continue_talk'],
  }
}

// Adapter placeholder: future greeting/memory contract -> memory VM.
export function mapGreetingToEcho(input: {
  id: string
  source: string
  time: string
  topic: string
  promptText: string
  detail: string
}): MemoryEchoCardVM {
  return {
    id: input.id,
    tab: 'memory',
    source: input.source,
    time: input.time,
    topic: input.topic,
    promptText: input.promptText,
    detail: input.detail,
    status: 'can_continue',
    primaryAction: 'continue_talk',
    secondaryActions: ['snooze_memory'],
  }
}
