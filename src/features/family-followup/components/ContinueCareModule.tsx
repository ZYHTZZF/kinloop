import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { followupTasks } from '../data/followupData'

export function ContinueCareModule() {
  return (
    <HomeModuleCard
      title="继续关心"
      subtitle="回填结果、安排回访"
      owner="子女端回访负责人"
      path="src/features/family-followup"
      actionLabel="完成回填"
    >
      <div className="stack-list">
        {followupTasks.map((task) => (
          <article className="list-panel" key={task.label}>
            <strong>{task.label}</strong>
            <p>{task.detail}</p>
          </article>
        ))}
      </div>
    </HomeModuleCard>
  )
}
