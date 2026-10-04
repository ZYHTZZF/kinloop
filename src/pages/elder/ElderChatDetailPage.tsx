import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ChatDetailView from '../../components/chat/ChatDetailView'
import { PRESET_MESSAGES_ELDER } from '../../domain/content/chatPrompts'
import { listConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'

export function ElderChatDetailPage() {
  const { userId, conversationId } = useParams<{ userId?: string; conversationId?: string }>()
  const targetId = userId || conversationId

  const [conversation, setConversation] = useState<ConversationCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadConversation = async () => {
      try {
        setIsLoading(true)
        const cards = await listConversationCards()
        const card = cards.find((c) => c.id === targetId)
        if (card) {
          setConversation(card)
          setError('')
        } else {
          setError('Conversation not found')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation')
      } finally {
        setIsLoading(false)
      }
    }

    if (targetId) {
      void loadConversation()
    }
  }, [targetId])

  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center', fontSize: '18px' }}>Loading...</div>
  }

  if (error || !conversation) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontSize: '18px' }}>
        Error: {error}
      </div>
    )
  }

  return (
    <ChatDetailView
      currentUserId="elder-1"
      otherUserId={targetId!}
      otherUserName={conversation.elderDisplayName}
      otherUserAvatar={conversation.avatar}
      isFamilyStyle={false}
      presetMessages={PRESET_MESSAGES_ELDER}
    />
  )
}

export default ElderChatDetailPage
