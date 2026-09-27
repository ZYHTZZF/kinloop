import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IConversation } from '../../services/api/types'
import * as chatApi from '../../services/api/chatApi'
import ChatList from '../chat/ChatList'
import styles from './FamilyChatListView.module.css'

interface FamilyChatListViewProps {
  currentUserId: string
}

const FamilyChatListView: React.FC<FamilyChatListViewProps> = ({ currentUserId }) => {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<IConversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 鍔犺浇瀵硅瘽鍒楄〃
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setIsLoading(true)
        const convs = await chatApi.getConversations(currentUserId)
        setConversations(convs.filter((c) => !c.isDeleted))
      } catch (error) {
        console.error('[FamilyChat] Failed to load conversations:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadConversations()

    // 瀹氭湡鍒锋柊
    const interval = setInterval(loadConversations, 10000)
    return () => clearInterval(interval)
  }, [currentUserId])

  // 閫夋嫨浼氳瘽
  const handleSelectConversation = (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId)
    if (conv) {
      setSelectedConversationId(conversationId)
      navigate(`/family/chats/${conv.otherUserId}`)
    }
  }

  // 鍒犻櫎浼氳瘽
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
      console.error('[FamilyChat] Failed to delete conversation:', error)
    }
  }

  return (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loadingState}>
          <p>鍔犺浇涓?..</p>
        </div>
      ) : (
        <ChatList
          conversations={conversations}
          selectedId={selectedConversationId || undefined}
          onSelectConversation={handleSelectConversation}
          onDelete={handleDeleteConversation}
          isFamilyStyle={false}
          showSearch={true}
        />
      )}
    </div>
  )
}

export default FamilyChatListView

