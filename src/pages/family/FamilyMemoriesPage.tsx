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
    <section className="screen screen--family-memories">
      <section className="surface-card">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">回忆</p>
            <h2>双端共享的时间线，先验证“显式加入”是否真正有价值。</h2>
          </div>
        </div>

        <div className="memory-timeline">
          {loading ? (
            <PageState
              title="正在读取家庭回忆时间线"
              description="稍等一下，我把家人共同留住的内容排成一条可回看的时间线。"
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
              title="还没有被加入回忆的内容"
              description="从聊天里点一次“加入回忆”，这里就会开始形成真正的家庭资产。"
            />
          ) : null}

          {memories.map((memory) => (
            <article className="memory-card" key={memory.id}>
              <div className="memory-card__meta">
                <span>{formatShortDate(memory.addedAt)}</span>
                <span>✨ 由 {resolveMemberName(memory.addedByMemberId, members)} 珍藏</span>
              </div>
              <h3>{memory.title ?? '未命名回忆'}</h3>
              <p>{memory.description ?? '暂无描述'}</p>
              {memory.mediaUrl ? <div className="memory-card__media">{memory.mediaUrl}</div> : null}
              <div className="inline-actions">
                <span className="status-pill">{memory.sourceMsgId ? '来自当时聊天' : '来自 AI 协助记录'}</span>
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
