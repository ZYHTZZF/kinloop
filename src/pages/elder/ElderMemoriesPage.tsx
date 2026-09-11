import { useEffect, useState } from 'react'
import { PageState } from '../../components/common/PageState'
import { listMemories, listMembers } from '../../services/api'
import type { Member, MemoryEntry } from '../../services/api'
import { formatShortDate } from '../../utils/dateTime'

export function ElderMemoriesPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [nextMemories, nextMembers] = await Promise.all([
          listMemories(),
          listMembers(),
        ])
        if (!cancelled) {
          setMemories(nextMemories)
          setMembers(nextMembers)
          setError('')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载回忆失败')
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
            <p className="surface-card__eyebrow">回忆</p>
            <h2>共同沉淀下来的那些片段，都从这里慢慢翻出来。</h2>
          </div>
        </div>

        <div className="memory-timeline">
          {loading ? (
            <PageState
              title="正在翻出已经记下来的片段"
              description="稍等一下，我把最近被留住的照片、语音和一句话慢慢铺开。"
            />
          ) : null}
          {error ? (
            <PageState
              variant="error"
              title="回忆时间线暂时没有连上本地服务"
              description={error}
            />
          ) : null}
          {!loading && !error && memories.length === 0 ? (
            <PageState
              title="回忆现在还是空的"
              description="等你和家人把某一句话、某张照片记下来，这里就会慢慢长出来。"
            />
          ) : null}

          {memories.map((memory) => (
            <article className="memory-card" key={memory.id}>
              <div className="memory-card__meta">
                <span>{formatShortDate(memory.addedAt)}</span>
                <span>由 {resolveMemberName(memory.addedByMemberId, members)} 加入</span>
              </div>
              <h3>{memory.title ?? '未命名回忆'}</h3>
              <p>{memory.description ?? '暂无描述'}</p>
              {memory.mediaUrl ? <div className="memory-card__media">{memory.mediaUrl}</div> : null}
              <div className="inline-actions">
                <span className="status-pill">{memory.sourceMsgId ? '来自聊天' : '来自 AI 帮忙记下'}</span>
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
