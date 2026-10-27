import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ElderVoiceIntentResult } from '../../domain/elderVoice'
import { PageState } from '../../components/common/PageState'
import { listMemories, listMembers, removeMemoryEntry } from '../../services/api'
import type { Member, MemoryEntry, MemoryItem } from '../../services/api'
import { formatShortDate, formatShortDateTime } from '../../utils/dateTime'
import { formatVoiceDuration } from '../../utils/chatVoice'

const text = {
  memory: '\u56de\u5fc6',
  heading: '\u7559\u4e0b\u7684\u7167\u7247\u3001\u8bed\u97f3\u548c\u4e00\u53e5\u8bdd\uff0c\u90fd\u653e\u5728\u8fd9\u91cc\u3002',
  home: '\u56de\u5230\u9996\u9875',
  loadingTitle: '\u6b63\u5728\u7ffb\u770b\u56de\u5fc6',
  loadingDesc: '\u7a0d\u7b49\u4e00\u4e0b\uff0c\u6211\u628a\u6700\u8fd1\u7559\u4e0b\u6765\u7684\u5185\u5bb9\u6162\u6162\u94fa\u5f00\u3002',
  errorTitle: '\u6682\u65f6\u65e0\u6cd5\u67e5\u770b\u56de\u5fc6',
  errorDesc: '\u56de\u5fc6\u5185\u5bb9\u6682\u65f6\u6ca1\u6709\u5237\u65b0\u51fa\u6765\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002',
  emptyTitle: '\u56de\u5fc6\u73b0\u5728\u8fd8\u662f\u7a7a\u7684',
  emptyDesc: '\u7b49\u4f60\u548c\u5bb6\u4eba\u628a\u60f3\u7559\u4f4f\u7684\u8bdd\u6216\u7167\u7247\u8bb0\u4e0b\u6765\uff0c\u8fd9\u91cc\u5c31\u4f1a\u6162\u6162\u957f\u51fa\u6765\u3002',
  by: '\u7531',
  added: '\u52a0\u5165',
  unnamed: '\u672a\u547d\u540d\u56de\u5fc6',
  viewSource: '\u67e5\u770b\u6765\u6e90\u804a\u5929',
  viewAnimation: '\u67e5\u770b\u751f\u6210\u52a8\u753b',
  animationReady: '\u7684\u751f\u6210\u52a8\u753b\u5165\u53e3\u5df2\u6253\u5f00\uff0c\u89c6\u9891\u751f\u6210\u6a21\u578b\u63a5\u5165\u540e\u4f1a\u5728\u8fd9\u91cc\u67e5\u770b\u7ed3\u679c\u3002',
  remove: '\u4ece\u56de\u5fc6\u4e2d\u79fb\u9664',
  removing: '\u79fb\u9664\u4e2d...',
  removeConfirmPrefix: '\u786e\u5b9a\u8981\u4ece\u56de\u5fc6\u4e2d\u79fb\u9664\u201c',
  removeConfirmSuffix: '\u201d\u5417\uff1f',
  removeError: '\u6682\u65f6\u6ca1\u6709\u79fb\u9664\u6210\u529f\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002',
  noDescription: '\u6682\u65f6\u8fd8\u6ca1\u6709\u8bf4\u660e\u3002',
  family: '\u5bb6\u4eba',
  imageAlt: '\u4fdd\u5b58\u7684\u56fe\u7247',
  imageUnavailable: '\u56fe\u7247\u6682\u65f6\u65e0\u6cd5\u663e\u793a',
  voiceUnavailable: '\u8bed\u97f3\u6682\u65f6\u65e0\u6cd5\u64ad\u653e',
}

export function ElderMemoriesPage() {
  const location = useLocation()
  const voiceResult = location.state?.elderVoiceResult as ElderVoiceIntentResult | undefined
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [animationFeedback, setAnimationFeedback] = useState('')
  const [removingMemoryId, setRemovingMemoryId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [nextMemories, nextMembers] = await Promise.all([listMemories(), listMembers()])
        if (!cancelled) {
          setMemories(nextMemories)
          setMembers(nextMembers)
          setError('')
        }
      } catch {
        if (!cancelled) {
          setError(text.errorDesc)
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
    <section className="screen screen--elder-memories">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">{text.memory}</p>
            <h2>{text.heading}</h2>
          </div>
          <Link className="ghost-action ghost-action--link" to="/elder/home">
            {text.home}
          </Link>
        </div>

        {voiceResult ? <p className="state-note">{voiceResult.promptTitle}</p> : null}

        <div className="memory-timeline">
          {animationFeedback ? <p className="state-note">{animationFeedback}</p> : null}
          {loading ? <PageState title={text.loadingTitle} description={text.loadingDesc} /> : null}
          {error ? <PageState variant="error" title={text.errorTitle} description={error} /> : null}
          {!loading && !error && memories.length === 0 ? (
            <PageState title={text.emptyTitle} description={text.emptyDesc} />
          ) : null}

          {memories.map((memory) => (
            <article className="memory-card" key={memory.id}>
              <div className="memory-card__meta">
                <span>{formatShortDate(memory.addedAt)}</span>
                <span>{text.by} {resolveMemberName(memory.addedByMemberId, members)} {text.added}</span>
              </div>
              <h3>{memory.title ?? text.unnamed}</h3>
              <MemoryContent memory={memory} />
              <div className="inline-actions">
                {getMemorySourceHref(memory) ? (
                  <Link className="ghost-action ghost-action--link" to={getMemorySourceHref(memory) ?? ''}>
                    {text.viewSource}
                  </Link>
                ) : null}
                <button
                  className="primary-action memory-animation-action"
                  type="button"
                  onClick={() => setAnimationFeedback(`${memory.title ?? text.unnamed}${text.animationReady}`)}
                >
                  {text.viewAnimation}
                </button>
                <button
                  className="ghost-action"
                  type="button"
                  disabled={removingMemoryId === memory.id}
                  onClick={() => void handleRemoveMemory(memory)}
                >
                  {removingMemoryId === memory.id ? text.removing : text.remove}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )

  async function handleRemoveMemory(memory: MemoryEntry) {
    const title = memory.title ?? text.unnamed
    if (!window.confirm(`${text.removeConfirmPrefix}${title}${text.removeConfirmSuffix}`)) {
      return
    }

    try {
      setRemovingMemoryId(memory.id)
      await removeMemoryEntry(memory.id)
      setMemories((current) => current.filter((item) => item.id !== memory.id))
      setAnimationFeedback('')
      setError('')
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : text.removeError)
    } finally {
      setRemovingMemoryId(null)
    }
  }
}

function MemoryContent({ memory }: { memory: MemoryEntry }) {
  if (memory.items && memory.items.length > 0) {
    return (
      <div className="memory-message-list">
        {memory.items.map((item) => (
          <MemoryMessageItem item={item} key={item.id} />
        ))}
      </div>
    )
  }

  return (
    <>
      <p>{memory.description ?? text.noDescription}</p>
      {memory.mediaUrl ? <div className="memory-card__media">{memory.mediaUrl}</div> : null}
    </>
  )
}

function getMemorySourceHref(memory: MemoryEntry) {
  const sourceItem = memory.items?.find((item) => item.sourceConvId) ?? null
  const sourceConvId = memory.sourceConvId ?? sourceItem?.sourceConvId ?? null
  const sourceMsgId = memory.sourceMsgId ?? sourceItem?.sourceMsgId ?? null

  if (!sourceConvId) return null

  const params = sourceMsgId ? `?messageId=${encodeURIComponent(sourceMsgId)}` : ''
  return `/elder/conversations/${encodeURIComponent(sourceConvId)}${params}`
}

function MemoryMessageItem({ item }: { item: MemoryItem }) {
  const senderName = item.senderDisplayName ?? text.family
  const itemText = item.textContent ?? item.transcript

  return (
    <div className="memory-message-item">
      <div className="memory-message-item__head">
        <span>{senderName}</span>
        {item.sentAt ? <span>{formatShortDateTime(item.sentAt)}</span> : null}
      </div>
      {item.messageType === 'Image' ? (
        <div className="memory-message-item__media">
          {item.mediaUrl ? <img src={item.mediaUrl} alt={`${senderName} ${text.imageAlt}`} /> : <span>{text.imageUnavailable}</span>}
        </div>
      ) : null}
      {item.messageType === 'Voice' ? (
        <div className="memory-message-item__voice">
          {item.mediaUrl ? <audio controls preload="metadata" src={item.mediaUrl} /> : <span>{text.voiceUnavailable}</span>}
          <span>{formatVoiceDuration(item.voiceDurationSec)}</span>
        </div>
      ) : null}
      {itemText ? <p>{itemText}</p> : null}
    </div>
  )
}

function resolveMemberName(memberId: string, members: Member[]) {
  return members.find((member) => member.id === memberId)?.displayName ?? memberId
}
