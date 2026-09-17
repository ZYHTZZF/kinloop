import React, { useState } from 'react'
import { IMessage, MessageStatus } from '../../services/api/types'
import styles from './ChatMessage.module.css'

interface ChatMessageProps {
  message: IMessage
  isMine: boolean
  senderAvatar?: string
  senderName?: string
  isFamilyStyle?: boolean
  onDelete?: (messageId: string) => void
  onForward?: (message: IMessage) => void
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isMine,
  senderAvatar,
  senderName,
  isFamilyStyle = false,
  onDelete,
  onForward
}) => {
  const [showMenu, setShowMenu] = useState(false)

  const renderMessageContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <div className={styles.textContent}>
            {message.content}
          </div>
        )

      case 'image':
        return (
          <div className={styles.imageContent}>
            <img
              src={message.mediaUrl}
              alt="Message image"
              className={styles.image}
            />
          </div>
        )

      case 'voice':
        return (
          <div className={styles.voiceContent}>
            <span className={styles.voiceIcon}>🔊</span>
            <span className={styles.voiceDuration}>
              {message.voiceDurationMs
                ? `${Math.ceil(message.voiceDurationMs / 1000)}"`
                : 'Voice'}
            </span>
          </div>
        )

      default:
        return <div className={styles.textContent}>{message.content}</div>
    }
  }

  const renderStatus = () => {
    if (isMine && (isFamilyStyle || !isFamilyStyle)) {
      const statusIcon = {
        [MessageStatus.SENDING]: '...',
        [MessageStatus.SENT]: '✓',
        [MessageStatus.DELIVERED]: '✓✓',
        [MessageStatus.READ]: '✓✓'
      }[message.status as MessageStatus] || '✓'

      const statusClass = message.status === MessageStatus.READ ? styles.statusRead : ''

      return (
        <span className={`${styles.status} ${statusClass}`}>
          {statusIcon}
        </span>
      )
    }
    return null
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const messageClasses = [
    styles.message,
    isMine ? styles.mine : styles.theirs,
    isFamilyStyle ? styles.familyStyle : styles.normalStyle,
    message.isDeleted ? styles.deleted : ''
  ]
    .filter(Boolean)
    .join(' ')

  const handleLongPress = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowMenu(!showMenu)
  }

  return (
    <div className={messageClasses} onContextMenu={handleLongPress}>
      {!isMine && senderAvatar && (
        <img src={senderAvatar} alt={senderName} className={styles.avatar} />
      )}

      <div className={styles.bubble}>
        {message.isDeleted ? (
          <div className={styles.deletedText}>此消息已被撤回</div>
        ) : (
          <>
            {renderMessageContent()}
            {renderStatus()}
          </>
        )}
      </div>

      <div className={styles.timestamp}>
        {formatTime(message.timestamp)}
      </div>

      {showMenu && (
        <div className={styles.contextMenu}>
          {onForward && (
            <button onClick={() => onForward(message)}>
              转发
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(message.id)}>
              删除
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ChatMessage
