import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { createMemoryEntry, getConversationDetail, sendMessage } from '../../services/api'
import type { ConversationDetail, Message } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

export function ElderConversationPage() {
  const { conversationId = 'daughter' } = useParams()
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftText, setDraftText] = useState('这花挺好看的。')
  const [sending, setSending] = useState(false)
  const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null)
  const [memoryFeedback, setMemoryFeedback] = useState('')
  const [savingAiMemory, setSavingAiMemory] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const nextConversation = await getConversationDetail(conversationId)
        if (!cancelled) {
          setConversation(nextConversation)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载会话失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [conversationId])

  const messages = conversation?.messages ?? []
  const familyMessageCount = messages.filter((message) => message.senderType === 'Family').length

  return (
    <section className="screen screen--elder-conversation">
      <section className="surface-card">
        <header className="detail-header">
          <Link className="back-link" to="/elder/contacts">
            ← 返回
          </Link>
          {conversation ? (
            <div className="detail-header__identity">
              <span className="avatar-badge">{conversation.avatar}</span>
              <div>
                <p className="surface-card__eyebrow">正在和谁说话</p>
                <h2>{conversation.name}</h2>
              </div>
            </div>
          ) : null}
        </header>

        {loading ? (
          <PageState
            title="正在打开这段家人对话"
            description="稍等一下，我把这位家人最近送来的话一条条摆好。"
          />
        ) : null}
        {error ? (
          <PageState
            variant="error"
            title="这段对话暂时没有连上本地服务"
            description={error}
          />
        ) : null}
        {memoryFeedback ? <p className="state-note">{memoryFeedback}</p> : null}

        {conversation ? (
          <article className="conversation-rhythm-card">
            <div>
              <span className="surface-card__eyebrow">这段对话的节奏</span>
              <strong>{conversation.name} 这次先送来内容，再等你慢慢回应。</strong>
            </div>
            <p>当前已经看到 {familyMessageCount} 条来自家人的内容。你可以先听完、看完，再决定是否用 AI 帮你回一句。</p>
          </article>
        ) : null}

        <div className="message-list">
          {!loading && !error && messages.length === 0 ? (
            <PageState
              title="这段对话现在还是空的"
              description="等家人发来一句话，或者你先请 AI 帮你回一句，这里就会开始慢慢展开。"
            />
          ) : null}

          {messages.map((message) => (
            <article
              key={message.id}
              className={`message-bubble message-bubble--${message.senderType === 'Family' ? 'family' : 'elder'}`}
            >
              <span className="message-bubble__sender">
                {getSenderLabel(message, conversation?.name ?? '家人')}
              </span>
              {message.messageType === 'Image' ? (
                <div className="message-media">
                  <span>{message.mediaUrl ?? '图片内容'}</span>
                </div>
              ) : null}
              <p>{message.textContent ?? message.transcript ?? '发来一段语音'}</p>
              <footer className="message-bubble__footer">
                <span>{formatClock(message.createdAt)}</span>
                {message.senderType === 'Family' ? (
                  <button
                    className="text-action"
                    type="button"
                    disabled={savingMemoryId === message.id}
                    onClick={() => void handleAddMemory(message)}
                  >
                    {savingMemoryId === message.id ? '保存中…' : '✨ 加入回忆'}
                  </button>
                ) : null}
                {message.aiDrafted ? <span className="status-pill">AI 代发</span> : null}
              </footer>
            </article>
          ))}
        </div>

        {conversation ? (
          <form className="ai-confirm-card" onSubmit={handleSubmitReply}>
            <p className="surface-card__eyebrow">AI 代发确认</p>
            <strong>准备告诉【{conversation.name}】：</strong>
            <input
              aria-label="AI 代发内容"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
            />
            <div className="inline-actions">
              <button className="ghost-action" type="button">
                修改
              </button>
              <button
                className="ghost-action"
                type="button"
                disabled={savingAiMemory || !draftText.trim()}
                onClick={() => void handleAddAiMemory()}
              >
                {savingAiMemory ? '记下中…' : '帮我记下来'}
              </button>
              <button className="primary-action" type="submit" disabled={sending || !draftText.trim()}>
                {sending ? '发送中…' : '发送'}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </section>
  )

  async function handleSubmitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!conversation || !draftText.trim()) {
      return
    }

    try {
      setSending(true)
      const nextConversation = await sendMessage(conversation.id, {
        senderType: 'Elder',
        senderMemberId: 'member_elder',
        messageType: 'Text',
        textContent: draftText.trim(),
        aiDrafted: true,
        isLowInformation: isLowInformation(draftText),
      })
      setConversation(nextConversation)
      setError('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'AI 代发失败')
    } finally {
      setSending(false)
    }
  }

  async function handleAddMemory(message: Message) {
    if (!conversation) {
      return
    }

    try {
      setSavingMemoryId(message.id)
      await createMemoryEntry({
        familySpaceId: 'fs_demo',
        sourceConvId: conversation.id,
        sourceMsgId: message.id,
        addedByMemberId: 'member_elder',
        memoryType: toMemoryType(message.messageType),
        title: buildFamilyMemoryTitle(conversation.name, message),
        description: message.textContent ?? message.transcript ?? '一段值得留住的内容',
        mediaUrl: message.mediaUrl,
      })
      setMemoryFeedback('这条回应已经记进回忆里了。')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '加入回忆失败')
    } finally {
      setSavingMemoryId(null)
    }
  }

  async function handleAddAiMemory() {
    if (!draftText.trim()) {
      return
    }

    try {
      setSavingAiMemory(true)
      await createMemoryEntry({
        familySpaceId: 'fs_demo',
        sourceConvId: conversation?.id ?? null,
        sourceMsgId: null,
        addedByMemberId: 'member_elder',
        memoryType: 'Text',
        title: '我想记住这句话',
        description: draftText.trim(),
        mediaUrl: null,
      })
      setMemoryFeedback('AI 已经帮你把这句话记到回忆里。')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'AI 加入回忆失败')
    } finally {
      setSavingAiMemory(false)
    }
  }
}

function getSenderLabel(message: Message, familyName: string) {
  if (message.senderType === 'Family') {
    return familyName
  }

  return '我'
}

function isLowInformation(input: string) {
  const normalized = input.trim()
  return ['嗯', '好', '好的', '收到', '知道了', '行'].includes(normalized)
}

function toMemoryType(messageType: string) {
  if (messageType === 'Image') return 'Image'
  if (messageType === 'Voice') return 'Voice'
  return 'Text'
}

function buildFamilyMemoryTitle(familyName: string, message: Message) {
  if (message.messageType === 'Image') {
    return `${familyName}发来的一张照片`
  }

  if (message.messageType === 'Voice') {
    return `${familyName}留给我的一段语音`
  }

  return `${familyName}说的一句话`
}
