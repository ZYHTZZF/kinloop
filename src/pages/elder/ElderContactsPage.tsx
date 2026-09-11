import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { listConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

export function ElderContactsPage() {
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
          setError(loadError instanceof Error ? loadError.message : '加载联络列表失败')
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
            <p className="surface-card__eyebrow">联络</p>
            <h2>所有家人的对话入口都在这里。</h2>
          </div>
          <button className="ghost-action" type="button">
            搜索
          </button>
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
              title="联络列表暂时没有连上本地服务"
              description={error}
            />
          ) : null}
          {!loading && !error && cards.length === 0 ? (
            <PageState
              title="现在还没有家人会话"
              description="等家人发来第一条问候后，这里就会开始慢慢热闹起来。"
            />
          ) : null}

          {cards.map((card) => (
            <Link className="list-row" key={card.id} to={`/elder/conversations/${card.id}`}>
              <div className="list-row__main">
                <span className="avatar-badge">{card.avatar}</span>
                <div>
                  <strong>{card.name}</strong>
                  <p>{card.primaryMessage?.preview ?? '暂无内容'}</p>
                </div>
              </div>
              <div className="list-row__meta">
                <span>{formatClock(card.lastActivityAt)}</span>
                {card.unreadCount > 0 ? <span className="status-pill">未读 {card.unreadCount}</span> : null}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}
