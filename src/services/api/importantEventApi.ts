import { apiGet, apiPost } from './client'
import { mockApiGet, mockApiPost } from './mockApi'
import type { ImportantEvent } from './types'

export function listImportantEvents() {
  return apiGet<ImportantEvent[]>('/important-events').catch((error) => {
    if (isRouteMissing(error)) {
      return mockApiGet<ImportantEvent[]>('/important-events')
    }

    throw error
  })
}

export function createImportantEvent(payload: {
  title: string
  eventType: 'birthday' | 'anniversary' | 'custom'
  calendarType: 'gregorian' | 'lunar'
  eventMonth: number
  eventDay: number
  note?: string | null
}) {
  return apiPost<ImportantEvent>('/important-events', payload).catch((error) => {
    if (isRouteMissing(error)) {
      return mockApiPost<ImportantEvent>('/important-events', payload)
    }

    throw error
  })
}

function isRouteMissing(error: unknown) {
  return error instanceof Error && /Request failed: 404/i.test(error.message)
}
