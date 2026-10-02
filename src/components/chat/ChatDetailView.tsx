import type { FC } from 'react'

type ChatDetailViewProps = {
  currentUserId: string
  otherUserId: string
  otherUserName: string
  otherUserAvatar?: string
  isFamilyStyle?: boolean
  presetMessages?: string[]
}

const ChatDetailView: FC<ChatDetailViewProps> = ({ otherUserName }) => {
  return (
    <section style={{ padding: '24px', borderRadius: '16px', background: '#fff7ea' }}>
      <p style={{ margin: 0, fontSize: '12px', color: '#7f6a4a', textTransform: 'uppercase' }}>Legacy Chat View</p>
      <h2 style={{ margin: '8px 0 0', fontSize: '20px', color: '#3e2f1d' }}>{otherUserName}</h2>
      <p style={{ margin: '12px 0 0', color: '#5d4c38', lineHeight: 1.6 }}>
        这个历史聊天详情组件当前不再作为主流程使用。正式链路已经切到新的会话页面和 API。
      </p>
    </section>
  )
}

export default ChatDetailView
