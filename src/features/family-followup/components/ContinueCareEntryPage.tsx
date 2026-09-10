import { useEffect, useState } from 'react'
import { FeatureEntryScaffold } from '../../../components/common/FeatureEntryScaffold'
import { followupRecords } from '../data/followupData'
import type { FollowupRecord } from '../types'

type ContinueCareEntryPageProps = {
  onBack: () => void
}

type StoredHelpRequest = {
  id: string
  title: string
  summary: string
  requester: string
  stage: 'triaged' | 'contacting' | 'scheduled' | 'resolved'
  responseGoal: string
}

type FollowupBucket = 'waiting' | 'mine' | 'resolved'

const HELP_STORAGE_KEY = 'kinloop-c-help-requests'
const UNCLAIMED_OWNER = '家人待接手'
const CURRENT_USER = '我'

const statusLabelMap = {
  waiting: '待处理',
  in_progress: '跟进中',
  stabilized: '已解决',
  escalated: '需重点关注',
} as const

const bucketMeta: Record<FollowupBucket, { title: string; subtitle: string }> = {
  waiting: {
    title: '待处理',
    subtitle: '先处理这些还没人接手的事情',
  },
  mine: {
    title: '跟进中',
    subtitle: '这里是我已经接手、还没结束的事情',
  },
  resolved: {
    title: '已完成',
    subtitle: '这些事情已经处理完成',
  },
}

const moduleGridStyle = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
} as const

const moduleButtonStyle = {
  display: 'grid',
  gap: '6px',
  padding: '18px',
  border: '1px solid rgba(86, 104, 147, 0.16)',
  borderRadius: '18px',
  background: '#fff',
  color: '#1e2440',
  textAlign: 'left' as const,
} as const

const activeModuleButtonStyle = {
  ...moduleButtonStyle,
  border: '1px solid rgba(80, 115, 215, 0.3)',
  background: 'linear-gradient(135deg, #f4f8ff 0%, #eef3ff 100%)',
  boxShadow: '0 12px 30px rgba(80, 115, 215, 0.12)',
} as const

const secondaryButtonStyle = {
  padding: '10px 14px',
  border: '1px solid rgba(86, 104, 147, 0.16)',
  borderRadius: '14px',
  background: '#fff',
  color: '#34425f',
} as const

function mapHelpStageToFollowupStatus(stage: StoredHelpRequest['stage']): FollowupRecord['status'] {
  if (stage === 'resolved') return 'stabilized'
  if (stage === 'scheduled') return 'in_progress'
  if (stage === 'contacting') return 'in_progress'
  return 'waiting'
}

function buildRecordsFromHelpRequests(helpRequests: StoredHelpRequest[]) {
  return helpRequests.map<FollowupRecord>((item) => ({
    id: `from-help-${item.id}`,
    elderName: item.requester || '老人本人',
    trigger: item.title,
    status: mapHelpStageToFollowupStatus(item.stage),
    nextTouchpoint: item.responseGoal,
    owner: UNCLAIMED_OWNER,
    summary: item.summary,
  }))
}

function loadRecords() {
  if (typeof window === 'undefined') return followupRecords

  const stored = window.localStorage.getItem(HELP_STORAGE_KEY)
  if (!stored) return followupRecords

  try {
    const parsed = JSON.parse(stored) as StoredHelpRequest[]
    if (parsed.length === 0) return followupRecords
    return buildRecordsFromHelpRequests(parsed)
  } catch {
    return followupRecords
  }
}

function claimRecord(record: FollowupRecord): FollowupRecord {
  return {
    ...record,
    owner: CURRENT_USER,
    status: record.status === 'stabilized' ? 'stabilized' : 'in_progress',
    nextTouchpoint: '由我继续跟进，稍后再确认一次情况',
  }
}

function markResolved(record: FollowupRecord): FollowupRecord {
  return {
    ...record,
    status: 'stabilized',
    nextTouchpoint: '已处理完成',
  }
}

export function ContinueCareEntryPage({ onBack }: ContinueCareEntryPageProps) {
  const [records, setRecords] = useState<FollowupRecord[]>(loadRecords)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeBucket, setActiveBucket] = useState<FollowupBucket>('waiting')

  useEffect(() => {
    const syncRecords = () => {
      setRecords(loadRecords())
    }

    window.addEventListener('storage', syncRecords)
    window.addEventListener('kinloop-help-updated', syncRecords)

    return () => {
      window.removeEventListener('storage', syncRecords)
      window.removeEventListener('kinloop-help-updated', syncRecords)
    }
  }, [])

  const waitingRecords = records.filter((item) => item.owner === UNCLAIMED_OWNER)
  const mineRecords = records.filter((item) => item.owner === CURRENT_USER && item.status !== 'stabilized')
  const resolvedRecords = records.filter((item) => item.status === 'stabilized')

  const bucketRecords: Record<FollowupBucket, FollowupRecord[]> = {
    waiting: waitingRecords,
    mine: mineRecords,
    resolved: resolvedRecords,
  }

  const visibleRecords = bucketRecords[activeBucket]

  const updateRecord = (id: string, updater: (record: FollowupRecord) => FollowupRecord) => {
    setRecords((current) =>
      current.map((item) => (item.id === id ? updater(item) : item)),
    )
  }

  return (
    <FeatureEntryScaffold
      eyebrow="继续关心"
      title="子女端 · 继续关心"
      summary="先点开要看的模块，再处理对应的事情。"
      owner="子女端回访负责人"
      path="src/features/family-followup"
      notes={[
        '待处理里放还没人接手的事情。',
        '跟进中和已完成分开查看，页面会更清楚。',
      ]}
      onBack={onBack}
    >
      <section className="stack-list">
        <article className="list-panel">
          <span>功能分区</span>
          <strong>先选你现在要看的模块</strong>
        </article>

        <div style={moduleGridStyle}>
          <button
            type="button"
            style={activeBucket === 'waiting' ? activeModuleButtonStyle : moduleButtonStyle}
            onClick={() => setActiveBucket('waiting')}
          >
            <span>待处理</span>
            <strong>{waitingRecords.length} 条</strong>
            <p>还没人接手</p>
          </button>

          <button
            type="button"
            style={activeBucket === 'mine' ? activeModuleButtonStyle : moduleButtonStyle}
            onClick={() => setActiveBucket('mine')}
          >
            <span>跟进中</span>
            <strong>{mineRecords.length} 条</strong>
            <p>我正在处理</p>
          </button>

          <button
            type="button"
            style={activeBucket === 'resolved' ? activeModuleButtonStyle : moduleButtonStyle}
            onClick={() => setActiveBucket('resolved')}
          >
            <span>已完成</span>
            <strong>{resolvedRecords.length} 条</strong>
            <p>已经处理结束</p>
          </button>
        </div>
      </section>

      <section className="stack-list">
        <article className="list-panel">
          <span>{bucketMeta[activeBucket].title}</span>
          <strong>{bucketMeta[activeBucket].subtitle}</strong>
        </article>

        {visibleRecords.length === 0 ? (
          <article className="list-panel">
            <strong>当前没有内容</strong>
            <p>这一栏暂时是空的，可以先切换到别的模块看看。</p>
          </article>
        ) : null}

        {visibleRecords.map((record) => {
          const isMine = record.owner === CURRENT_USER
          const isUnclaimed = record.owner === UNCLAIMED_OWNER
          const isExpanded = expandedId === record.id

          return (
            <article className="list-panel" key={record.id}>
              <span>
                {record.elderName} · {record.owner} · {statusLabelMap[record.status]}
              </span>
              <strong>{record.trigger}</strong>
              <p>{record.summary}</p>
              <p>当前进度：{record.nextTouchpoint}</p>

              {isExpanded ? (
                <article className="list-panel">
                  <span>跟进情况</span>
                  <strong>{record.owner}</strong>
                  <p>{record.nextTouchpoint}</p>
                </article>
              ) : null}

              <div className="action-row">
                {isUnclaimed ? (
                  <button
                    style={secondaryButtonStyle}
                    type="button"
                    onClick={() => updateRecord(record.id, claimRecord)}
                  >
                    我来跟进
                  </button>
                ) : (
                  <button
                    style={secondaryButtonStyle}
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    {isExpanded ? '收起进度' : '查看跟进进度'}
                  </button>
                )}

                {isMine && record.status !== 'stabilized' ? (
                  <button
                    style={secondaryButtonStyle}
                    type="button"
                    onClick={() => updateRecord(record.id, markResolved)}
                  >
                    已解决
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </section>
    </FeatureEntryScaffold>
  )
}
