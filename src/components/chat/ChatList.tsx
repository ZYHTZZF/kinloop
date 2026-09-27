import React, { useState } from 'react'
import { IConversation } from '../../services/api/types'
import styles from './ChatList.module.css'

interface ChatListProps {
  conversations: IConversation[]
  selectedId?: string
  onSelectConversation: (id: string) => void
  onDelete?: (id: string) => void
  isFamilyStyle?: boolean
  showSearch?: boolean
  onSearch?: (query: string) => void
}

const ChatList: React.FC<ChatListProps> = ({
  conversations,
  selectedId,
  onSelectConversation,
  onDelete,
  isFamilyStyle = false,
  showSearch = false,
  onSearch
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    if (onSearch) {
      onSearch(query)
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true
    return (
      conv.otherUserName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const handleDeleteClick = (conversationId: string) => {
    if (deleteConfirm === conversationId) {
      // Confirm delete
      if (onDelete) {
        onDelete(conversationId)
      }
      setDeleteConfirm(null)
    } else {
      // Show confirmation
      setDeleteConfirm(conversationId)
    }
  }

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return ''

    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // 同一天
    if (diff < 86400000) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // 昨天
    if (diff < 172800000) {
      return '昨天'
    }

    // 本周
    if (diff < 604800000) {
      return date.toLocaleDateString('zh-CN', { weekday: 'short' })
    }

    // 其他
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    })
  }

  const listClasses = [
    styles.chatList,
    isFamilyStyle ? styles.familyStyle : styles.normalStyle
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={listClasses}>
      {showSearch && (
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="搜索对话..."
            value={searchQuery}
            onChange={handleSearch}
            className={styles.searchInput}
          />
        </div>
      )}

      <div className={styles.conversationList}>
        {filteredConversations.length === 0 ? (
          <div className={styles.emptyState}>
            <p>暂无对话</p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={`${styles.conversationItem} ${
                selectedId === conv.id ? styles.selected : ''
              } ${deleteConfirm === conv.id ? styles.deleteConfirm : ''}`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className={styles.avatar}>
                {conv.otherUserAvatar ? (
                  <img src={conv.otherUserAvatar} alt={conv.otherUserName} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {conv.otherUserName?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              <div className={styles.content}>
                <div className={styles.header}>
                  <div className={styles.name}>{conv.otherUserName}</div>
                  <div className={styles.time}>
                    {formatTime(conv.lastActivityAt)}
                  </div>
                </div>

                <div className={styles.footer}>
                  <div className={styles.lastMessage}>
                    {conv.lastMessage || '(无消息)'}
                  </div>
                  {conv.unreadCount > 0 && (
                    <div className={styles.badge}>{conv.unreadCount}</div>
                  )}
                </div>
              </div>

              {onDelete && deleteConfirm === conv.id && (
                <button
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteClick(conv.id)
                  }}
                >
                  确认删除
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ChatList
