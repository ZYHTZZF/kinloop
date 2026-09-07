import { FeatureEntryScaffold } from '../../../components/common/FeatureEntryScaffold'
import { echoItems } from '../data/echoData'

type EchoEntryPageProps = {
  onBack: () => void
}

export function EchoEntryPage({ onBack }: EchoEntryPageProps) {
  return (
    <FeatureEntryScaffold
      eyebrow="回音"
      title="长辈端 · 回音"
      summary="这里先保留“家人回应”和“我的回忆 / 关心记录”的模块接口，后面继续在本目录细化。"
      owner="长辈端回音负责人"
      path="src/features/elder-echo"
      notes={[
        '后续如果要拆“家人回应”和“我的回忆”两个子区块，也建议仍然在本模块内完成。',
        '首页和其他模块只关心跳转，不直接耦合这里的业务细节。',
      ]}
      onBack={onBack}
    >
      {echoItems.map((item) => (
        <article className="list-panel" key={item.title}>
          <span>{item.source}</span>
          <strong>{item.title}</strong>
          <p>{item.detail}</p>
        </article>
      ))}
    </FeatureEntryScaffold>
  )
}
