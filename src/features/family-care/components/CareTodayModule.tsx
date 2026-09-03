import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { careActions } from '../data/careData'

export function CareTodayModule() {
  return (
    <HomeModuleCard
      title="今日关怀"
      subtitle="怎么开口、立即行动"
      owner="子女端关怀负责人"
      path="src/features/family-care"
      actionLabel="开始关怀"
    >
      <div className="stack-list">
        {careActions.map((item) => (
          <article className="list-panel" key={item.label}>
            <strong>{item.label}</strong>
            <p>{item.note}</p>
          </article>
        ))}
      </div>
    </HomeModuleCard>
  )
}
