import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { helpRequests } from '../data/helpData'

type HelpModuleProps = {
  onOpen: () => void
}

const quickLabels = ['联系家人', '我不舒服', '需要人来看看'] as const

const stageLabelMap = {
  triaged: '待分流',
  contacting: '联系中',
  scheduled: '已安排',
  resolved: '已闭环',
} as const

export function HelpModule({ onOpen }: HelpModuleProps) {
  const activeRequests = helpRequests.filter((item) => item.stage !== 'resolved')

  return (
    <HomeModuleCard
      title="找人帮忙"
      subtitle="语音优先求助"
      owner="长辈端求助负责人"
      path="src/features/elder-help"
      actionLabel="开始求助"
      onAction={onOpen}
    >
      <div className="action-row">
        {quickLabels.map((label) => (
          <button key={label} className="action-chip" type="button">
            {label}
          </button>
        ))}
      </div>

      <div className="stack-list">
        <article className="list-panel">
          <span>入口方式</span>
          <strong>点一句话，或者直接说一句话</strong>
          <p>老人不用先填表，系统会把求助自动整理成后续可处理的记录。</p>
        </article>

        {activeRequests.slice(0, 2).map((request) => (
          <article className="list-panel" key={request.id}>
            <span>
              {stageLabelMap[request.stage]} · {request.responseGoal}
            </span>
            <strong>{request.title}</strong>
            <p>{request.summary}</p>
          </article>
        ))}
      </div>

      <p className="module-hint">长辈端先把求助表达出来，后续分流和闭环再交给处理链路。</p>
    </HomeModuleCard>
  )
}
