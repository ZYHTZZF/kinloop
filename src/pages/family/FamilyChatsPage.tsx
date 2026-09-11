import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { listConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

export function FamilyChatsPage() {
  const [cards, setCards] = useState<ConversationCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const nextCards = await listConversationCards()
        if (!cancelled) {
          setCards(nextCards)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载聊天列表失败')
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
  }, [])

  return (
    <section className="screen">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">聊天</p>
            <h2>家人端仍然是熟悉的会话流，但长辈端会以更适老的方式展示。</h2>
          </div>
        </div>

        <div className="list-stack">
          {loading ? (
            <PageState
              title="正在同步会话"
              description="我先把长辈最近看到和回应过的内容整理出来。"
            />
          ) : null}
          {error ? (
            <PageState
              variant="error"
              title="聊天列表暂时没有连上本地服务"
              description={error}
            />
          ) : null}
          {!loading && !error && cards.length === 0 ? (
            <PageState
              title="现在还没有对话"
              description="等第一条家人问候发送出去之后，这里就会出现会话记录。"
            />
          ) : null}

          {cards.map((card) => (
            <Link className="list-row" key={card.id} to={`/family/chats/${card.id}`}>
              <div className="list-row__main">
                <span className="avatar-badge">{card.avatar}</span>
                <div>
                  <strong>妈妈</strong>
                  <p>{card.primaryMessage?.preview ?? '暂无消息'}</p>
                </div>
              </div>
              <div className="list-row__meta">
                <span>{formatClock(card.lastActivityAt)}</span>
                <span className="status-pill">{card.unreadCount > 0 ? `动态 ${card.unreadCount}` : '已同步'}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}
