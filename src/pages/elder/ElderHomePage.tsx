import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

export function ElderHomePage() {
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
          setError(loadError instanceof Error ? loadError.message : '加载会话带失败')
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
    <section className="screen screen--elder-home">
      <section className="surface-card surface-card--elder-voice-home">
        <div className="elder-home__hero-copy">
          <p className="surface-card__eyebrow">陪你说话</p>
          <h2>想说什么，按住下面的按钮说就行。</h2>
          <p>我会先听懂你的意思，再帮你找家人，或者帮你联系上人。</p>
        </div>

        <div className="elder-home__hero-actions">
          <div className="elder-home__voice-prompt">
            <strong>先按住说话</strong>
            <p>比如说“我想和女儿说句话”或“我有点不舒服”。</p>
          </div>
          <Link className="elder-home__quick-link elder-home__quick-link--warn" to="/elder/help">
            <span>紧急求助</span>
            <strong>我现在需要找人</strong>
          </Link>
        </div>
      </section>

      <section className="surface-card surface-card--strip">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">家人来信</p>
            <h2>先看看家人刚刚发来的内容。</h2>
          </div>
          <Link className="ghost-action ghost-action--link" to="/elder/inbox">
            查看全部
          </Link>
        </div>

        <div className="conversation-strip" role="list" aria-label="家人来信">
          {loading ? <p className="state-note">正在加载家人的来信…</p> : null}
          {error ? <p className="state-note state-note--error">本地 API 未连接：{error}</p> : null}

          {!loading && !error
            ? cards.slice(0, 3).map((card) => (
                <article className="conversation-card conversation-card--action" key={card.id} role="listitem">
                  <div className="conversation-card__handle" aria-hidden="true" />
                  <div className="conversation-card__header">
                    <Link className="avatar-link" to={`/elder/conversations/${card.id}`}>
                      <span className="avatar-badge">{card.avatar}</span>
                      <span>
                        <strong>{card.name}</strong>
                        <small>{formatClock(card.lastActivityAt)}</small>
                      </span>
                    </Link>
                  </div>

                  <Link className="conversation-card__body" to={`/elder/conversations/${card.id}`}>
                    {card.primaryMessage?.type === 'image' ? (
                      <div className="content-preview content-preview--image">
                        <span>{card.primaryMessage.mediaLabel ?? '照片内容'}</span>
                      </div>
                    ) : null}

                    {card.primaryMessage?.type === 'voice' ? (
                      <div className="content-preview content-preview--voice">
                        <span>▶</span>
                        <p>{card.primaryMessage.preview}</p>
                      </div>
                    ) : null}

                    {card.primaryMessage?.type === 'text' ? (
                      <div className="content-preview content-preview--text">
                        <p>{card.primaryMessage.preview}</p>
                      </div>
                    ) : null}
                  </Link>

                  <footer className="conversation-card__footer">
                    <span>{card.unreadCount > 0 ? `未读 ${card.unreadCount}` : '点开看看'}</span>
                    <span>进入聊天</span>
                  </footer>
                </article>
              ))
            : null}
        </div>
      </section>

      <section className="surface-card surface-card--strip">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">联系家人</p>
            <h2>想找谁说话，点一下头像就能进去。</h2>
          </div>
        </div>

        <div className="elder-home__avatar-grid" role="list" aria-label="家人头像入口">
          {loading ? <p className="state-note">正在整理家人的头像…</p> : null}
          {error ? <p className="state-note state-note--error">本地 API 未连接：{error}</p> : null}

          {!loading && !error
            ? cards.map((card) => (
                <Link className="elder-home__avatar-card" key={card.id} to={`/elder/conversations/${card.id}`} role="listitem">
                  <span className="avatar-badge elder-home__avatar-badge">{card.avatar}</span>
                  <strong>{card.name}</strong>
                  <span>{card.unreadCount > 0 ? `${card.unreadCount} 条新消息` : '直接进入聊天'}</span>
                </Link>
              ))
            : null}
        </div>
      </section>
    </section>
  )
}
