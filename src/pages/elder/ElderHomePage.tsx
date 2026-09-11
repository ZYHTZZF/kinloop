import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { talkPreview, echoItems } from '../../domain/content/conversationPrompts'
import { listConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

export function ElderHomePage() {
  const [cards, setCards] = useState<ConversationCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const unreadConversationCount = cards.filter((card) => card.unreadCount > 0).length
  const unreadMessageCount = cards.reduce((sum, card) => sum + card.unreadCount, 0)

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
      <div className="elder-home__hero-grid">
        <section className="surface-card surface-card--status">
          <div>
            <p className="surface-card__eyebrow">轻状态</p>
            <h2>10:30 AM</h2>
          </div>
          <p>晴天 22°C · 今天适合慢慢听、慢慢说。</p>
        </section>

        <section className="surface-card surface-card--ai">
          <div className="ai-presence">
            <div className="ai-presence__glow" aria-hidden="true" />
            <div>
              <p className="surface-card__eyebrow">AI 常驻</p>
              <h2>早上好，老李。女儿刚发来一张照片。</h2>
              <p>你可以直接按住下面的语音按钮，也可以先看看家人捎来的话。</p>
            </div>
          </div>

          <div className="split-grid">
            <article className="support-card">
              <p className="surface-card__eyebrow">今天可以这样开口</p>
              <div className="list-stack">
                {talkPreview.map((item) => (
                  <div className="signal-row" key={`${item.speaker}-${item.text}`}>
                    <strong>{item.speaker}</strong>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="support-card">
              <p className="surface-card__eyebrow">最近值得继续说</p>
              <div className="list-stack">
                {echoItems.map((item) => (
                  <div className="signal-row" key={`${item.source}-${item.title}`}>
                    <span>{item.source}</span>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>

      <section className="surface-card surface-card--strip">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">家人会话带</p>
            <h2>一人一框，先看到真实内容，再决定要不要点进去聊。</h2>
          </div>
          <p className="section-heading__hint">默认静止 · 左右滑动闭环浏览</p>
        </div>

        <div className="elder-home__note-strip">
          <div className="note-card">
            <span className="surface-card__eyebrow">今天有人来过</span>
            <strong>{unreadConversationCount} 位家人有新来信</strong>
            <p>一共还有 {unreadMessageCount} 条内容没看。先看最新的一句，再决定要不要点进去慢慢聊。</p>
          </div>
          <div className="note-card note-card--quiet">
            <span className="surface-card__eyebrow">现在最适合</span>
            <strong>先看，再开口</strong>
            <p>如果一时不知道怎么回，先按住语音按钮说一句“帮我慢慢回”。</p>
          </div>
        </div>

        <div className="conversation-strip" role="list" aria-label="家人会话带">
          {loading ? <p className="state-note">正在加载家人的来信…</p> : null}
          {error ? <p className="state-note state-note--error">本地 API 未连接：{error}</p> : null}

          {!loading && !error
            ? cards.map((card) => (
                <article className="conversation-card" key={card.id} role="listitem">
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
                    <span>● 未读 {card.unreadCount}</span>
                    <span>{card.unreadSummary}</span>
                  </footer>
                </article>
              ))
            : null}
        </div>
      </section>
    </section>
  )
}
