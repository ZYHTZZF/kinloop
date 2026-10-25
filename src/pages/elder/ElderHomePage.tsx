import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from '../../components/common/PageState'
import { listConversationCards, listHeartPosts, readCachedConversationCards } from '../../services/api'
import type { ConversationCard, HeartPost } from '../../services/api'
import { formatClock, formatShortDateTime } from '../../utils/dateTime'

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
}

const fallbackCards: FilmCardItem[] = [
  {
    id: 'fallback_daughter',
    avatar: '女',
    name: '大女儿',
    timeLabel: '刚刚',
    unreadLabel: '新消息 2',
    previewType: 'image',
    title: '花开了，拍给你看',
    detail: '今天路边的花开得很好，我一下就想到你了。',
    footer: '点开继续看照片和语音',
  },
  {
    id: 'fallback_son',
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
    id: 'fallback_neighbor',
    avatar: '友',
    name: '王阿姨',
    timeLabel: '昨天',
    unreadLabel: '刚看过',
    previewType: 'text',
    title: '晚上一起散步吗',
    detail: '如果天不下雨，晚上我们一起下楼走一走。',
    footer: '点开继续聊聊天',
  },
]

export function ElderHomePage() {
  const [cards, setCards] = useState<ConversationCard[]>(() => readCachedConversationCards('elder'))
  const [loading, setLoading] = useState(() => readCachedConversationCards('elder').length === 0)
  const [error, setError] = useState('')
  const [heartPosts, setHeartPosts] = useState<HeartPost[]>([])
  const [heartsLoading, setHeartsLoading] = useState(true)
  const [heartsError, setHeartsError] = useState('')
  const [activeFilmIndex, setActiveFilmIndex] = useState(0)

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
      } catch {
        if (!cancelled) {
          setError('暂时无法同步最新消息，请稍后再试。')
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

  useEffect(() => {
    let cancelled = false

    async function loadHeartBoard() {
      try {
        const nextPosts = await listHeartPosts()
        if (!cancelled) {
          setHeartPosts(nextPosts)
          setHeartsError('')
        }
      } catch {
        if (!cancelled) {
          setHeartsError('家庭心语暂时还没同步出来，请稍后再试。')
        }
      } finally {
        if (!cancelled) {
          setHeartsLoading(false)
        }
      }
    }

    void loadHeartBoard()

    return () => {
      cancelled = true
    }
  }, [])

  const usingFallbackCards = !loading && Boolean(error)
  const familyCards = cards.filter((card) => card.conversationType !== 'AI_ASSISTANT')
  const filmCards = usingFallbackCards ? fallbackCards : familyCards.slice(0, 5).map(mapConversationToFilmCard)
  const activeFilmCard = filmCards[activeFilmIndex] ?? filmCards[0]
  const latestHeartPost = heartPosts[0] ?? null
  const filmHeadline = loading ? '家人刚刚给你发来了新消息' : getFilmHeadline(activeFilmCard)

  useEffect(() => {
    setActiveFilmIndex(0)
  }, [usingFallbackCards, cards.length])

  return (
    <section className="screen screen--elder-home">
      <section className="surface-card surface-card--film-strip">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">最近来信</p>
            <h2>{filmHeadline}</h2>
            <p className="elder-home__film-hint">轻轻点开，就能继续看，也能继续聊。</p>
          </div>
          <Link className="ghost-action ghost-action--link" to="/elder/inbox">
            查看全部
          </Link>
        </div>

        <div className="elder-film-stage">
          <button
            className="elder-film-control elder-film-control--prev"
            type="button"
            aria-label="上一条消息"
            disabled={filmCards.length <= 1}
            onClick={() => shiftActiveFilm(-1, filmCards.length, setActiveFilmIndex)}
          >
            ‹
          </button>

          <div className="elder-film-strip" role="list" aria-label="家人来信卡片">
            {loading ? <p className="state-note">正在整理家人最近发来的内容…</p> : null}
            {!loading && !usingFallbackCards && filmCards.length === 0 ? (
              <PageState title="现在还没有新消息" description="等家人发来问候后，这里就会慢慢热闹起来。" />
            ) : null}

            {!loading || usingFallbackCards
              ? filmCards.map((card, index) => {
                  const relativeOffset = getRelativeOffset(index, activeFilmIndex, filmCards.length)

                  if (Math.abs(relativeOffset) > 2) {
                    return null
                  }

                  const className = [
                    'elder-film-card',
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
                        <strong className="elder-film-card__cta">
                          {relativeOffset === 0 ? '点开继续看' : '点一下放大'}
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
                      onClick={() => setActiveFilmIndex(index)}
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
            aria-label="下一条消息"
            disabled={filmCards.length <= 1}
            onClick={() => shiftActiveFilm(1, filmCards.length, setActiveFilmIndex)}
          >
            ›
          </button>
        </div>

        {usingFallbackCards ? <p className="state-note">现在先看看最近联系人，稍后再回来刷新最新内容。</p> : null}
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">家人心语</p>
            <h2>家里最近的新动态，也会在这里提醒你。</h2>
          </div>
          <Link className="ghost-action ghost-action--link" to="/elder/hearts">
            去看看
          </Link>
        </div>

        {heartsLoading ? <PageState title="正在整理最近心语" description="稍等一下，我把全家的新动态放在这里。" /> : null}
        {!heartsLoading && heartsError ? <PageState variant="error" title="暂时无法查看心语" description={heartsError} /> : null}
        {!heartsLoading && !heartsError && !latestHeartPost ? (
          <PageState title="还没有新动态" description="你和家人都可以去心语页发一条，整个家庭都能看到。" />
        ) : null}

        {!heartsLoading && !heartsError && latestHeartPost ? (
          <Link className="list-row heart-home-card" to="/elder/hearts">
            <div className="list-row__main">
              <span className="avatar-badge">{getHeartPostInitial(latestHeartPost)}</span>
              <div>
                <strong>{latestHeartPost.authorDisplayName}</strong>
                <p>{latestHeartPost.content || (latestHeartPost.imageUrl ? '发来一张新照片' : '刚刚更新了一条动态')}</p>
              </div>
            </div>
            <div className="list-row__meta">
              <span>{formatShortDateTime(latestHeartPost.createdAt)}</span>
              <span className="status-pill">{`共 ${heartPosts.length} 条`}</span>
            </div>
          </Link>
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
    unreadLabel: card.unreadCount > 0 ? `新消息 ${card.unreadCount}` : '刚看过',
    previewType: card.primaryMessage?.type ?? 'text',
    title: card.primaryMessage?.mediaLabel ?? card.primaryMessage?.preview ?? '家人刚刚发来了一条消息',
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
      return `${card.name}给你发来了新照片`
    case 'voice':
      return `${card.name}给你发来了一段语音`
    case 'video':
      return `${card.name}给你发来了一段视频`
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

function getHeartPostInitial(post: HeartPost) {
  const displayName = post.authorDisplayName || ''
  return displayName.trim().charAt(0) || '家'
}
