import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageState } from './PageState'
import {
  createHeartPost,
  createHeartPostComment,
  listHeartPosts,
  toggleHeartPostLike,
  uploadHeartPostImage,
} from '../../services/api'
import type { HeartPost } from '../../services/api'
import { ensureChatImageFile, readFileAsDataUrl } from '../../utils/chatImage'
import { formatShortDateTime } from '../../utils/dateTime'

type HeartPostBoardProps = {
  eyebrow: string
  title: string
  hint: string
  actionLink?: {
    to: string
    label: string
  }
}

type SelectedHeartImage = {
  fileName: string
  dataUrl: string
}

export function HeartPostBoard({ eyebrow, title, hint, actionLink }: HeartPostBoardProps) {
  const composerId = useId()
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [posts, setPosts] = useState<HeartPost[]>([])
  const [draft, setDraft] = useState('')
  const [selectedImage, setSelectedImage] = useState<SelectedHeartImage | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [likePendingById, setLikePendingById] = useState<Record<string, boolean>>({})
  const [commentPendingById, setCommentPendingById] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false

    async function loadPosts() {
      try {
        const nextPosts = await listHeartPosts()
        if (!cancelled) {
          setPosts(nextPosts)
          setLoadError('')
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '心语列表暂时还没同步出来，请稍后再试。')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPosts()

    return () => {
      cancelled = true
    }
  }, [])

  function replacePost(nextPost: HeartPost) {
    setPosts((current) => current.map((post) => (post.id === nextPost.id ? nextPost : post)))
  }

  function clearSelectedImage() {
    setSelectedImage(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  async function handleSelectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const imageFile = ensureChatImageFile(file)
      const dataUrl = await readFileAsDataUrl(imageFile)
      setSelectedImage({
        fileName: imageFile.name,
        dataUrl,
      })
      setActionError('')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '图片暂时没有选上，请稍后再试。')
      clearSelectedImage()
    }
  }

  async function handleSubmit() {
    const content = draft.trim()
    if ((!content && !selectedImage) || submitting) {
      return
    }

    try {
      setSubmitting(true)
      setActionError('')

      let imageUrl: string | null = null
      if (selectedImage) {
        const uploadResult = await uploadHeartPostImage({ dataUrl: selectedImage.dataUrl })
        imageUrl = uploadResult.imageUrl
      }

      const createdPost = await createHeartPost({
        content: content || undefined,
        imageUrl,
      })

      setPosts((current) => [createdPost, ...current])
      setDraft('')
      clearSelectedImage()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '发布心语失败，请稍后再试。')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleLike(postId: string) {
    if (likePendingById[postId]) {
      return
    }

    try {
      setLikePendingById((current) => ({ ...current, [postId]: true }))
      setActionError('')
      const nextPost = await toggleHeartPostLike(postId)
      replacePost(nextPost)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '点赞失败，请稍后再试。')
    } finally {
      setLikePendingById((current) => ({ ...current, [postId]: false }))
    }
  }

  async function handleSubmitComment(postId: string) {
    const content = `${commentDrafts[postId] ?? ''}`.trim()
    if (!content || commentPendingById[postId]) {
      return
    }

    try {
      setCommentPendingById((current) => ({ ...current, [postId]: true }))
      setActionError('')
      const nextPost = await createHeartPostComment(postId, { content })
      replacePost(nextPost)
      setCommentDrafts((current) => ({ ...current, [postId]: '' }))
      setExpandedComments((current) => ({ ...current, [postId]: true }))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '评论失败，请稍后再试。')
    } finally {
      setCommentPendingById((current) => ({ ...current, [postId]: false }))
    }
  }

  return (
    <section className="surface-card surface-card--heart-board">
      <div className="section-heading">
        <div>
          <p className="surface-card__eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="section-heading__hint">{hint}</p>
        </div>
        {actionLink ? (
          <Link className="ghost-action ghost-action--link" to={actionLink.to}>
            {actionLink.label}
          </Link>
        ) : null}
      </div>

      <div className="heart-composer">
        <div className="heart-composer__hero">
          <div>
            <label className="heart-composer__label" htmlFor={composerId}>
              发一条全家都能看到的动态
            </label>
            <p className="heart-composer__hint">可以只发一句话，也可以配一张照片。</p>
          </div>
          <span className="status-pill">全家可见</span>
        </div>

        <textarea
          id={composerId}
          className="heart-composer__textarea"
          value={draft}
          maxLength={280}
          placeholder="比如：今天出去晒了太阳，路边的花开得很漂亮。"
          onChange={(event) => setDraft(event.target.value)}
        />

        <input
          ref={imageInputRef}
          className="heart-composer__media-input"
          type="file"
          accept="image/*"
          onChange={(event) => void handleSelectImage(event)}
        />

        {selectedImage ? (
          <div className="heart-composer__preview">
            <img src={selectedImage.dataUrl} alt="待发布照片预览" />
            <button className="ghost-action" type="button" onClick={clearSelectedImage}>
              移除照片
            </button>
          </div>
        ) : null}

        {actionError ? <div className="heart-board__feedback welcome-error">{actionError}</div> : null}

        <div className="heart-composer__footer">
          <div className="heart-composer__tools">
            <button
              className="ghost-action heart-composer__media-button"
              type="button"
              disabled={submitting}
              onClick={() => imageInputRef.current?.click()}
            >
              加照片
            </button>
            <span className="heart-composer__meta">{draft.trim().length}/280</span>
          </div>

          <button
            className="primary-action heart-composer__submit"
            type="button"
            disabled={submitting || (!draft.trim() && !selectedImage)}
            onClick={() => void handleSubmit()}
          >
            {submitting ? '发布中...' : '发布动态'}
          </button>
        </div>
      </div>

      <div className="list-stack">
        {loading ? <PageState title="正在整理家庭心语" description="稍等一下，我把最近的动态排在前面。" /> : null}
        {!loading && loadError ? <PageState variant="error" title="暂时无法查看心语" description={loadError} /> : null}
        {!loading && !loadError && posts.length === 0 ? (
          <PageState title="现在还没有动态" description="你和家人都可以先发一条，让这个板块热闹起来。" />
        ) : null}

        {!loading && !loadError
          ? posts.map((post) => {
              const commentsOpen = expandedComments[post.id] ?? post.comments.length > 0

              return (
                <article className="heart-card" key={post.id}>
                  <div className="heart-card__head">
                    <div className="heart-card__author">
                      <span className="avatar-badge">{getHeartPostInitial(post)}</span>
                      <div>
                        <strong>{post.authorDisplayName}</strong>
                        <p>{post.authorRelationLabel || mapHeartPostRole(post.authorRole)}</p>
                      </div>
                    </div>

                    <div className="heart-card__meta">
                      <span>{formatShortDateTime(post.createdAt)}</span>
                      <span className="status-pill">全家可见</span>
                    </div>
                  </div>

                  {post.content ? <p className="heart-card__content">{post.content}</p> : null}

                  {post.imageUrl ? (
                    <div className="heart-card__media">
                      <img src={post.imageUrl} alt={`${post.authorDisplayName} 发布的动态照片`} />
                    </div>
                  ) : null}

                  <div className="heart-card__actions">
                    <button
                      className={`heart-action${post.likedByViewer ? ' is-active' : ''}`}
                      type="button"
                      disabled={Boolean(likePendingById[post.id])}
                      onClick={() => void handleToggleLike(post.id)}
                    >
                      {post.likedByViewer ? '已点赞' : '点赞'}
                      <span>{post.likeCount}</span>
                    </button>

                    <button
                      className={`heart-action${commentsOpen ? ' is-active' : ''}`}
                      type="button"
                      onClick={() => setExpandedComments((current) => ({ ...current, [post.id]: !commentsOpen }))}
                    >
                      评论
                      <span>{post.comments.length}</span>
                    </button>
                  </div>

                  {commentsOpen ? (
                    <div className="heart-comments">
                      {post.comments.length > 0 ? (
                        <div className="heart-comment-list">
                          {post.comments.map((comment) => (
                            <article className="heart-comment" key={comment.id}>
                              <span className="heart-comment__avatar">{getHeartCommentInitial(comment.authorDisplayName)}</span>
                              <div className="heart-comment__body">
                                <div className="heart-comment__head">
                                  <strong>{comment.authorDisplayName}</strong>
                                  <span>{formatShortDateTime(comment.createdAt)}</span>
                                </div>
                                <p>{comment.content}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="heart-comments__empty">还没有评论，你可以先说一句。</p>
                      )}

                      <div className="heart-comment-composer">
                        <input
                          className="heart-comment-composer__input"
                          value={commentDrafts[post.id] ?? ''}
                          maxLength={180}
                          placeholder="写一句回应..."
                          onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                        />
                        <button
                          className="ghost-action heart-comment-composer__submit"
                          type="button"
                          disabled={Boolean(commentPendingById[post.id]) || !`${commentDrafts[post.id] ?? ''}`.trim()}
                          onClick={() => void handleSubmitComment(post.id)}
                        >
                          {commentPendingById[post.id] ? '发送中...' : '发送'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })
          : null}
      </div>
    </section>
  )
}

function getHeartPostInitial(post: HeartPost) {
  const displayName = post.authorDisplayName || ''
  return displayName.trim().charAt(0) || '家'
}

function getHeartCommentInitial(displayName: string) {
  return displayName.trim().charAt(0) || '家'
}

function mapHeartPostRole(role: string) {
  return role === 'elder' ? '长辈' : '家人'
}
