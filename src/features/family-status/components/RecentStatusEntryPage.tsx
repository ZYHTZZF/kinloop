import { FeatureEntryScaffold } from '../../../components/common/FeatureEntryScaffold'
import { statusItems } from '../data/statusData'

type RecentStatusEntryPageProps = {
  onBack: () => void
}

export function RecentStatusEntryPage({ onBack }: RecentStatusEntryPageProps) {
  return (
    <FeatureEntryScaffold
      eyebrow="最近状态"
      title="子女端 · 最近状态"
      summary="这里先保留“老人最近变化与联系原因”的模块接口，后续状态摘要和原因判断都在本模块继续开发。"
      owner="子女端状态负责人"
      path="src/features/family-status"
      notes={[
        '如果后面要引入风险等级、联系原因和变化时间线，建议都继续放在本模块里。',
        '其他模块尽量只消费这里产出的摘要，不直接修改这里的数据结构。',
      ]}
      onBack={onBack}
    >
      {statusItems.map((item) => (
        <article className="timeline-row" key={`${item.time}-${item.title}`}>
          <span>{item.time}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
        </article>
      ))}
    </FeatureEntryScaffold>
  )
}
