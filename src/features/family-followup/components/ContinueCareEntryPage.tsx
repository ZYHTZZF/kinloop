import { FeatureEntryScaffold } from '../../../components/common/FeatureEntryScaffold'
import { followupTasks } from '../data/followupData'

type ContinueCareEntryPageProps = {
  onBack: () => void
}

export function ContinueCareEntryPage({ onBack }: ContinueCareEntryPageProps) {
  return (
    <FeatureEntryScaffold
      eyebrow="继续关心"
      title="子女端 · 继续关心"
      summary="这里先保留“回填结果、安排回访”的模块接口，后续闭环和回访能力都在这个目录内继续开发。"
      owner="子女端回访负责人"
      path="src/features/family-followup"
      notes={[
        '回填结果、回访时间和后续安排后面都建议在本模块里闭环。',
        '其他模块如果需要接入回访，只做跳转或状态读取，避免直接耦合流程细节。',
      ]}
      onBack={onBack}
    >
      {followupTasks.map((task) => (
        <article className="list-panel" key={task.label}>
          <strong>{task.label}</strong>
          <p>{task.detail}</p>
        </article>
      ))}
    </FeatureEntryScaffold>
  )
}
