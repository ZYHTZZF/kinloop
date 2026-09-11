import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { followupRecords } from '../data/followupData'

type ContinueCareModuleProps = {
  onOpen: () => void
}

type StoredHelpRequest = {
  id: string
  title: string
  summary: string
  requester: string
  responseGoal: string
}

const HELP_STORAGE_KEY = 'kinloop-c-help-requests'

const statusLabelMap = {
  waiting: '待处理',
  in_progress: '跟进中',
  stabilized: '已稳定',
  escalated: '继续升级',
} as const

function loadPendingCount() {
  if (typeof window === 'undefined') {
    return followupRecords.filter((item) => item.status !== 'stabilized').length
  }

  const stored = window.localStorage.getItem(HELP_STORAGE_KEY)
  if (!stored) {
    return followupRecords.filter((item) => item.status !== 'stabilized').length
  }

  try {
    const parsed = JSON.parse(stored) as StoredHelpRequest[]
    return parsed.length > 0
      ? parsed.length
      : followupRecords.filter((item) => item.status !== 'stabilized').length
  } catch {
    return followupRecords.filter((item) => item.status !== 'stabilized').length
  }
}

export function ContinueCareModule({ onOpen }: ContinueCareModuleProps) {
  const pendingCount = loadPendingCount()

  return (
    <HomeModuleCard
      title="继续关心"
      subtitle="按钮式跟进"
      owner="子女端回访负责人"
      path="src/features/family-followup"
      actionLabel="进入处理台"
      onAction={onOpen}
    >
      <div className="stack-list">
        <article className="list-panel">
          <span>当前概览</span>
          <strong>{pendingCount} 条记录还需要继续关心</strong>
          <p>长辈端发出的求助会在这里汇总，方便子女快速处理。</p>
        </article>
      </div>

      <div className="stack-list">
        {followupRecords.slice(0, 2).map((record) => (
          <article className="list-panel" key={record.id}>
            <span>
              {record.elderName} · {statusLabelMap[record.status]}
            </span>
            <strong>{record.nextTouchpoint}</strong>
            <p>{record.summary}</p>
          </article>
        ))}
      </div>
    </HomeModuleCard>
  )
}
