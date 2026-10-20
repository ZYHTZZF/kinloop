import { useEffect, useRef, useState } from 'react'
import { buildApiUrl } from '../../platform/apiConfig'
import { createApiHeaders } from '../../services/api/client'
import type { Message } from '../../services/api/types'

export interface MemoryData {
  id: string
  title: string
  summary: string
  date: string
  keyword?: string
}

export function useMemoryTrigger(message: Message) {
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const checked = useRef(false)

  useEffect(() => {
    if (message.messageType !== 'Text' || !message.textContent || checked.current) {
      return
    }

    checked.current = true

    const checkMemory = async () => {
      setLoading(true)
      try {
        const response = await fetch(buildApiUrl('/memories/trigger'), {
          method: 'POST',
          headers: createApiHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            messageId: message.id,
            text: message.textContent,
            userId: message.senderMemberId,
          }),
        })

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }

        const data = await response.json()
        if (data.triggered && data.memory) {
          setMemoryData(data.memory)
        }
      } catch (error) {
        console.error('Failed to trigger memory:', error)
      } finally {
        setLoading(false)
      }
    }

    void checkMemory()
  }, [message.id, message.messageType, message.textContent, message.senderMemberId])

  return { memoryData, loading }
}
