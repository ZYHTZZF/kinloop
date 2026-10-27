import { apiDelete, apiGet, apiPost } from './client'
import type { MemoryEntry } from './types'

export function listMemories() {
  return apiGet<MemoryEntry[]>('/memories')
}

export function createMemoryEntry(payload: Record<string, unknown>) {
  return apiPost<MemoryEntry>('/memories', payload)
}

export function removeMemoryEntry(memoryId: string) {
  return apiDelete<void>(`/memories/${memoryId}`)
}
