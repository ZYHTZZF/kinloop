import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { listConversationCards, readCachedConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

export function ElderContactsPage() {
  const [cards, setCards] = useState<ConversationCard[]>(() => sortElderContacts(readCachedConversationCards('elder')))
  const [loading, setLoading] = useState(() => readCachedConversationCards('elder').length === 0)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const cachedCards = readCachedConversationCards('elder')
    if (cachedCards.length > 0) {
      setCards(sortElderContacts(cachedCards))
      setLoading(false)
    }

    async function load() {
      try {
        const nextCards = await listConversationCards()
        if (!cancelled) {
          setCards(sortElderContacts(nextCards))
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载来信列表失败')
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
            <p className="surface-card__eyebrow">家人来信</p>
            <h2>家人最近捎来的内容，都在这里。</h2>
          </div>
          <Link className="ghost-action ghost-action--link" to="/elder/home">
            回到首页
          </Link>
        </div>

        <div className="list-stack">
          {loading ? (
            <PageState
              title="正在整理最近的家人来信"
              description="稍等一下，我把今天适合先看的会话排在前面。"
            />
          ) : null}
          {error ? (
            <PageState
              variant="error"
              title="来信列表暂时没有连上本地服务"
              description={error}
            />
          ) : null}
          {!loading && !error && cards.length === 0 ? (
            <PageState
              title="现在还没有家人会话"
              description="等家人发来第一条问候后，这里就会慢慢有内容了。"
            />
          ) : null}

          {cards.map((card) => (
            <Link
              className={`list-row${card.conversationType === 'AI_ASSISTANT' ? ' list-row--ai' : ''}`}
              key={card.id}
              to={`/elder/conversations/${card.id}`}
            >
              <div className="list-row__main">
                <span className="avatar-badge">{card.avatar}</span>
                <div>
                  <strong>
                    {card.name}
                    {card.conversationType === 'AI_ASSISTANT' ? (
                      <span className="status-pill status-pill--ai">AI助手</span>
                    ) : null}
                  </strong>
                  <p>{card.primaryMessage?.preview ?? '暂无内容'}</p>
                </div>
              </div>
              <div className="list-row__meta">
                <span>{formatClock(card.lastActivityAt)}</span>
                {card.conversationType !== 'AI_ASSISTANT' && card.unreadCount > 0 ? (
                  <span className="status-pill">未读 {card.unreadCount}</span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}

function sortElderContacts(cards: ConversationCard[]) {
  return [...cards].sort((a, b) => {
    const aAi = a.conversationType === 'AI_ASSISTANT' ? 1 : 0
    const bAi = b.conversationType === 'AI_ASSISTANT' ? 1 : 0
    if (aAi !== bAi) return bAi - aAi
    return Number(b.lastActivityAt ?? 0) - Number(a.lastActivityAt ?? 0)
  })
}
