import { FeatureEntryScaffold } from '../../../components/common/FeatureEntryScaffold'
import { careActions } from '../data/careData'

type CareTodayEntryPageProps = {
  onBack: () => void
}

export function CareTodayEntryPage({ onBack }: CareTodayEntryPageProps) {
  return (
    <FeatureEntryScaffold
      eyebrow="今日关怀"
      title="子女端 · 今日关怀"
      summary="这里先保留“怎么开口”和“立即行动”的模块接口，后续推荐话术、动作建议都在本模块继续开发。"
      owner="子女端关怀负责人"
      path="src/features/family-care"
      notes={[
        '话术推荐、行动建议和时间提示后面都可以直接往这个模块加。',
        '首页只展示摘要，避免别的模块直接改这里的内部逻辑。',
      ]}
      onBack={onBack}
    >
      {careActions.map((item) => (
        <article className="list-panel" key={item.label}>
          <strong>{item.label}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </FeatureEntryScaffold>
  )
}
