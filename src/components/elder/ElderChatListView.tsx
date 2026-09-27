import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IConversation } from '../../services/api/types'
import * as chatApi from '../../services/api/chatApi'
import ChatList from '../chat/ChatList'
import styles from './ElderChatListView.module.css'

interface ElderChatListViewProps {
  currentUserId: string
}

const ElderChatListView: React.FC<ElderChatListViewProps> = ({ currentUserId }) => {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<IConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 加载对话列表
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsLoading(true)
        const convs = await chatApi.getConversations(currentUserId)
        // 老人端只显示主要联系人（最多3个）
        setConversations(
          convs
            .filter((c) => !c.isDeleted)
            .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
            .slice(0, 3)
        )
      } catch (error) {
        console.error('[ElderChat] Failed to load conversations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadConversations()

    // 定期刷新
    const interval = setInterval(loadConversations, 10000)
    return () => clearInterval(interval)
  }, [currentUserId])

  // 选择会话
  const handleSelectConversation = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId)
    if (conv) {
      setSelectedConversationId(conversationId)
      navigate(`/elder/chats/${conv.otherUserId}`)
    }
  }

  // 删除会话
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const conv = conversations.find((c) => c.id === conversationId)
      if (conv) {
        await chatApi.deleteConversation(currentUserId, conv.otherUserId)
        setConversations((prev) =>
          prev.filter((c) => c.id !== conversationId)
        )
      }
    } catch (error) {
      console.error('[ElderChat] Failed to delete conversation:', error)
    }
  }

  return (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loadingState}>
          <p>加载中...</p>
        </div>
      ) : (
        <ChatList
          conversations={conversations}
          selectedId={selectedConversationId || undefined}
          onSelectConversation={handleSelectConversation}
          onDelete={handleDeleteConversation}
          isFamilyStyle={true}
          showSearch={false}
        />
      )}
    </div>
  )
}

export default ElderChatListView
