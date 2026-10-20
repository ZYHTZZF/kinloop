import { useEffect, useState } from 'react'
import { PageState } from '../../components/common/PageState'
import { listMemories, listMembers } from '../../services/api'
import type { Member, MemoryEntry } from '../../services/api'
import { formatShortDate, formatShortDateTime } from '../../utils/dateTime'

export function FamilyMemoriesPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
          setError('回忆内容暂时没有刷新出来，请稍后再试。')
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
    <section className="screen screen--family-memories">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">回忆</p>
            <h2>把一家人一起留下来的内容，慢慢攒成一条时间线。</h2>
          </div>
        </div>

        <div className="memory-timeline">
          {loading ? <PageState title="正在整理家庭回忆" description="稍等一下，我把最近留下来的内容排好。" /> : null}
          {error ? <PageState variant="error" title="暂时无法查看回忆" description={error} /> : null}
          {!loading && !error && memories.length === 0 ? (
            <PageState
              title="还没有加入回忆的内容"
              description="从聊天里点一次“加入回忆”，这里就会慢慢充实起来。"
            />
          ) : null}

          {memories.map((memory) => (
            <article className="memory-card" key={memory.id}>
              <div className="memory-card__meta">
                <span>{formatShortDate(memory.addedAt)}</span>
                <span>由 {resolveMemberName(memory.addedByMemberId, members)} 留下</span>
              </div>
              <h3>{memory.title ?? '未命名回忆'}</h3>
              <p>{memory.description ?? '暂时还没有说明'}</p>
              {memory.mediaUrl ? <div className="memory-card__media">{memory.mediaUrl}</div> : null}
              <div className="inline-actions">
                <span className="status-pill">{memory.sourceMsgId ? '来自当时聊天' : '来自稍后整理'}</span>
                <button className="ghost-action" type="button">
                  回看来源 · {formatShortDateTime(memory.addedAt)}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}

function resolveMemberName(memberId: string, members: Member[]) {
  return members.find((member) => member.id === memberId)?.displayName ?? memberId
}
