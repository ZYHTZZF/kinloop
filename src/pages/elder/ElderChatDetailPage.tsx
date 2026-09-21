import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ChatDetailView from '../../components/chat/ChatDetailView'
import { PRESET_MESSAGES_ELDER } from '../../domain/content/chatPrompts'
import { listConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'

export function ElderChatDetailPage() {
  const { userId, conversationId } = useParams<{ userId?: string, conversationId?: string }>()
  // Compatibility: some links map to /conversations/:conversationId, others to /chats/:userId
  const targetId = userId || conversationId

  const [conversation, setConversation] = useState<ConversationCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // 获取当前登录用户信息（简化处理）
  const currentUserId = targetId || 'elder-1'

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
          setError('对话不存在')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载对话失败')
      } finally {
        setIsLoading(false)
      }
    }

    if (targetId) {
      loadConversation()
    }
  }, [targetId])

  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center', fontSize: '18px' }}>加载中...</div>
  }

  if (error || !conversation) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontSize: '18px' }}>
        错误: {error}
      </div>
    )
  }

  return (
    <ChatDetailView
      currentUserId={'elder-1'}
      otherUserId={targetId!}
      otherUserName={conversation.elderDisplayName}
      otherUserAvatar={conversation.avatar}
      isFamilyStyle={false}
      presetMessages={PRESET_MESSAGES_ELDER}
    />
  )
}

export default ElderChatDetailPage
