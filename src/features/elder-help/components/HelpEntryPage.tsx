import { FeatureEntryScaffold } from '../../../components/common/FeatureEntryScaffold'
import { helpActions } from '../data/helpData'

type HelpEntryPageProps = {
  onBack: () => void
}

export function HelpEntryPage({ onBack }: HelpEntryPageProps) {
  return (
    <FeatureEntryScaffold
      eyebrow="找人帮忙"
      title="长辈端 · 找人帮忙"
      summary="这里先保留联系家人、人工支持和紧急求助的接口占位，后续升级逻辑都可以在本模块继续开发。"
      owner="长辈端求助负责人"
      path="src/features/elder-help"
      notes={[
        '紧急求助的确认、升级和兜底流程后续建议只在本模块维护。',
        '其他模块如果需要触发求助，尽量只通过跳转或事件触发，不直接写这里的内部逻辑。',
      ]}
      onBack={onBack}
    >
      <div className="action-row">
        {helpActions.map((action) => (
          <button
            key={action.label}
            className={`action-chip ${action.tone === 'primary' ? 'action-chip--primary' : ''}`}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
    </FeatureEntryScaffold>
  )
}
