import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { recentStatusCardsSeed } from '../data/statusData'

type RecentStatusModuleProps = {
  onOpen: () => void
}

export function RecentStatusModule({ onOpen }: RecentStatusModuleProps) {
  return (
    <HomeModuleCard
      title="最近状态"
      subtitle="为什么现在联系、下一步做什么"
      owner="子女端状态负责人"
      path="src/features/family-status"
      actionLabel="查看状态"
      onAction={onOpen}
    >
      <div className="stack-list">
        {recentStatusCardsSeed.slice(0, 2).map((item) => (
          <article className="list-panel" key={item.id}>
            <span>{item.time}</span>
            <strong>{item.title}</strong>
            <p>联系原因：{item.reason}</p>
          </article>
        ))}
      </div>
    </HomeModuleCard>
  )
}
