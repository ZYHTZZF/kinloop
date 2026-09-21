import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ChatDetailView from '../../components/chat/ChatDetailView'
import { listConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'

export function FamilyChatDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const [conversation, setConversation] = useState<ConversationCard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // 获取当前登录用户信息（简化处理，实际应从 Context/Redux 获取）
  const currentUserId = 'family-1'

  useEffect(() => {
    const loadConversation = async () => {
      try {
        setIsLoading(true)
        const cards = await listConversationCards()
        const card = cards.find((c) => c.id === userId)
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

    if (userId) {
      loadConversation()
    }
  }, [userId])

  if (isLoading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>加载中...</div>
  }

  if (error || !conversation) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>错误: {error}</div>
  }

  return (
    <ChatDetailView
      currentUserId={currentUserId}
      otherUserId={userId!}
      otherUserName={conversation.elderDisplayName}
      otherUserAvatar={conversation.avatar}
      isFamilyStyle={true}
    />
  )
}

export default FamilyChatDetailPage
