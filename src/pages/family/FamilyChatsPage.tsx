import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { listConversationCards, readCachedConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

export function FamilyChatsPage() {
  const [cards, setCards] = useState<ConversationCard[]>(() => readCachedConversationCards('family'))
  const [loading, setLoading] = useState(() => readCachedConversationCards('family').length === 0)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const cachedCards = readCachedConversationCards('family')
    if (cachedCards.length > 0) {
      setCards(cachedCards)
      setLoading(false)
    }

    async function load() {
      try {
        const nextCards = await listConversationCards('family')
        if (!cancelled) {
          setCards(nextCards)
          setError('')
        }
      } catch {
        if (!cancelled) {
          setError('聊天列表暂时没有刷新出来，请稍后再试。')
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
    <section className="screen screen--family-chats">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">聊天</p>
            <h2>联系人</h2>
          </div>
        </div>

        <div className="list-stack">
          {loading ? <PageState title="正在同步聊天列表" description="稍等一下，我把最近的消息整理出来。" /> : null}
          {error ? <PageState variant="error" title="暂时无法查看聊天列表" description={error} /> : null}
          {!loading && !error && cards.length === 0 ? (
            <PageState title="现在还没有对话" description="等第一条消息发出后，这里就会出现聊天记录。" />
          ) : null}

          {cards.map((card) => (
            <Link className="list-row" key={card.id} to={`/family/chats/${card.id}`}>
              <div className="list-row__main">
                <span className="avatar-badge">{getContactInitial(card)}</span>
                <div>
                  <strong>{getConversationDisplayName(card)}</strong>
                  <p>{card.primaryMessage?.preview ?? '暂时还没有新内容'}</p>
                </div>
              </div>
              <div className="list-row__meta">
                <span>{formatClock(card.lastActivityAt)}</span>
                <span className="status-pill">{card.unreadCount > 0 ? `未读 ${card.unreadCount}` : '已看过'}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}

function getContactInitial(card: ConversationCard) {
  const displayName = getConversationDisplayName(card) || card.avatar || ''
  return displayName.trim().charAt(0) || '家'
}

function getConversationDisplayName(card: ConversationCard) {
  return card.isGroup ? (card.groupName ?? card.name) : card.elderDisplayName
}
