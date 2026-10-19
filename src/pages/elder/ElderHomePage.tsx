import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listConversationCards, readCachedConversationCards } from '../../services/api'
import type { ConversationCard } from '../../services/api'
import { formatClock } from '../../utils/dateTime'

type FilmCardItem = {
  id: string
  avatar: string
  name: string
  timeLabel: string
  unreadLabel: string
  previewType: 'image' | 'voice' | 'video' | 'text'
  title: string
  detail: string
  footer: string
  to?: string
  isMock?: boolean
}

const mockFilmCards: FilmCardItem[] = [
  {
    id: 'mock_daughter',
    avatar: '女',
    name: '大女儿',
    timeLabel: '刚刚',
    unreadLabel: '新消息 2',
    previewType: 'image',
    title: '花开了，拍给你看',
    detail: '今天路边的花开得很好，我一下就想到你。',
    footer: '点开继续看照片和语音',
  },
  {
    id: 'mock_son',
    avatar: '子',
    name: '小儿子',
    timeLabel: '15:20',
    unreadLabel: '新消息 1',
    previewType: 'voice',
    title: '周末回家吃饭',
    detail: '妈，我周末带孩子回去，咱们一起吃顿饭。',
    footer: '点开继续听这段语音',
  },
  {
    id: 'mock_neighbor',
    avatar: '王',
    name: '王阿姨',
    timeLabel: '昨天',
    unreadLabel: '刚刚看过',
    previewType: 'text',
    title: '晚上一起散步吗',
    detail: '如果天不下雨，晚上我们一起下楼走一走。',
    footer: '点开继续聊聊',
  },
]

export function ElderHomePage() {
  const [cards, setCards] = useState<ConversationCard[]>(() => readCachedConversationCards('elder'))
  const [loading, setLoading] = useState(() => readCachedConversationCards('elder').length === 0)
  const [error, setError] = useState('')
  const [activeMockCardId, setActiveMockCardId] = useState(mockFilmCards[0]?.id ?? '')

  useEffect(() => {
    let cancelled = false

    const cachedCards = readCachedConversationCards('elder')
    if (cachedCards.length > 0) {
      setCards(cachedCards)
      setLoading(false)
    }

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

  const usingMockCards = !loading && Boolean(error)
  const familyCards = cards.filter((card) => card.conversationType !== 'AI_ASSISTANT')
  const filmCards = usingMockCards ? mockFilmCards : familyCards.slice(0, 5).map(mapConversationToFilmCard)
  const [activeFilmIndex, setActiveFilmIndex] = useState(0)
  const activeMockCard = mockFilmCards.find((card) => card.id === activeMockCardId) ?? mockFilmCards[0]
  const activeFilmCard = filmCards[activeFilmIndex] ?? filmCards[0]
  const filmHeadline = loading ? '家人刚刚给你发来了新消息' : getFilmHeadline(activeFilmCard)

  useEffect(() => {
    setActiveFilmIndex(0)
  }, [usingMockCards, cards.length])

  return (
    <section className="screen screen--elder-home">
      <section className="surface-card surface-card--film-strip">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">最近消息</p>
            <h2>{filmHeadline}</h2>
            <p className="elder-home__film-hint">点开就能接着看。</p>
          </div>
          <Link className="ghost-action ghost-action--link" to="/elder/inbox">
            查看全部
          </Link>
        </div>

        <div className="elder-film-stage">
          <button
            className="elder-film-control elder-film-control--prev"
            type="button"
            aria-label="上一张消息"
            disabled={filmCards.length <= 1}
            onClick={() => shiftActiveFilm(-1, filmCards.length, setActiveFilmIndex)}
          >
            ‹
          </button>

          <div className="elder-film-strip" role="list" aria-label="家人来信胶片">
          {loading ? <p className="state-note">正在加载家人的来信…</p> : null}

          {!loading || usingMockCards
            ? filmCards.map((card, index) => {
                const relativeOffset = getRelativeOffset(index, activeFilmIndex, filmCards.length)

                if (Math.abs(relativeOffset) > 2) {
                  return null
                }

                const className = [
                  'elder-film-card',
                  card.isMock ? 'elder-film-card--mock' : '',
                  relativeOffset === 0 ? 'is-active' : '',
                  relativeOffset === -1 ? 'is-left' : '',
                  relativeOffset === 1 ? 'is-right' : '',
                  relativeOffset === -2 ? 'is-far-left' : '',
                  relativeOffset === 2 ? 'is-far-right' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                const inner = (
                  <>
                  <div className="elder-film-card__sprocket elder-film-card__sprocket--left" aria-hidden="true" />
                  <div className="elder-film-card__sprocket elder-film-card__sprocket--right" aria-hidden="true" />

                  <div className="elder-film-card__header">
                    <div className="avatar-link">
                      <span className="avatar-badge">{card.avatar}</span>
                      <span>
                        <strong>{card.name}</strong>
                        <small>{card.timeLabel}</small>
                      </span>
                    </div>
                    <span className="status-pill">{card.unreadLabel}</span>
                  </div>

                  <div className="elder-film-card__body">
                    {card.previewType === 'image' ? (
                      <div className="content-preview content-preview--image">
                        <span>{card.title}</span>
                      </div>
                    ) : null}

                    {card.previewType === 'voice' ? (
                      <div className="content-preview content-preview--voice">
                        <span>▶</span>
                        <p>{card.detail}</p>
                      </div>
                    ) : null}

                    {card.previewType === 'text' ? (
                      <div className="content-preview content-preview--text">
                        <p>{card.detail}</p>
                      </div>
                    ) : null}
                  </div>

                  <footer className="elder-film-card__footer">
                    <span>{card.footer}</span>
                    <strong className={card.isMock ? 'elder-film-card__cta elder-film-card__cta--mock' : 'elder-film-card__cta'}>
                      {card.isMock ? '这是示例' : relativeOffset === 0 ? '点开继续看' : '点一下放大'}
                    </strong>
                  </footer>
                  </>
                )

                if (card.to) {
                  return (
                    <Link
                      key={card.id}
                      className={className}
                      to={card.to}
                      role="listitem"
                      onClick={(event) => {
                        if (relativeOffset !== 0) {
                          event.preventDefault()
                          setActiveFilmIndex(index)
                        }
                      }}
                    >
                      {inner}
                    </Link>
                  )
                }

                return (
                  <button
                    key={card.id}
                    className={className}
                    type="button"
                    role="listitem"
                    onClick={() => {
                      setActiveFilmIndex(index)
                      setActiveMockCardId(card.id)
                    }}
                  >
                    {inner}
                  </button>
                )
              })
            : null}
          </div>

          <button
            className="elder-film-control elder-film-control--next"
            type="button"
            aria-label="下一张消息"
            disabled={filmCards.length <= 1}
            onClick={() => shiftActiveFilm(1, filmCards.length, setActiveFilmIndex)}
          >
            ›
          </button>
        </div>

        {usingMockCards ? (
          <div className="elder-film-preview">
            <p className="state-note">
              本地 API 暂时没有连上，现在先用示例胶片演示交互。
            </p>
            {activeMockCard ? (
              <article className="elder-film-preview__card">
                <div>
                  <p className="surface-card__eyebrow">当前示例</p>
                  <strong>{activeMockCard.name}</strong>
                </div>
                <p>{activeMockCard.detail}</p>
              </article>
            ) : null}
          </div>
        ) : null}
      </section>
    </section>
  )
}

function mapConversationToFilmCard(card: ConversationCard): FilmCardItem {
  return {
    id: card.id,
    avatar: card.avatar,
    name: card.name,
    timeLabel: formatClock(card.lastActivityAt),
    unreadLabel: card.unreadCount > 0 ? `新消息 ${card.unreadCount}` : '刚刚看过',
    previewType: card.primaryMessage?.type ?? 'text',
    title: card.primaryMessage?.mediaLabel ?? card.primaryMessage?.preview ?? '家人刚刚发来一条消息',
    detail: card.primaryMessage?.preview ?? card.unreadSummary,
    footer: card.unreadSummary,
    to: `/elder/conversations/${card.id}`,
  }
}

function getFilmHeadline(card?: FilmCardItem) {
  if (!card) {
    return '家人刚刚给你发来了新消息'
  }

  switch (card.previewType) {
    case 'image':
      return `${card.name}给你发了新照片`
    case 'voice':
      return `${card.name}给你发来一段语音`
    case 'video':
      return `${card.name}给你发来一段视频`
    default:
      return `${card.name}刚刚给你发来消息`
  }
}

function getRelativeOffset(index: number, activeIndex: number, total: number) {
  let offset = index - activeIndex

  if (offset > total / 2) {
    offset -= total
  }

  if (offset < -total / 2) {
    offset += total
  }

  return offset
}

function shiftActiveFilm(direction: number, total: number, setActiveFilmIndex: (updater: (value: number) => number) => void) {
  if (total <= 1) {
    return
  }

  setActiveFilmIndex((current) => (current + direction + total) % total)
}
