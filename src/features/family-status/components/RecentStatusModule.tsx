import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { statusItems } from '../data/statusData'

export function RecentStatusModule() {
  return (
    <HomeModuleCard
      title="最近状态"
      subtitle="为什么现在联系"
      owner="子女端状态负责人"
      path="src/features/family-status"
      actionLabel="查看变化"
    >
      <div className="stack-list">
        {statusItems.map((item) => (
          <article className="timeline-row" key={`${item.time}-${item.title}`}>
            <span>{item.time}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </HomeModuleCard>
  )
}
