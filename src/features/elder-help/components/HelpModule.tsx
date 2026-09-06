import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { helpActions } from '../data/helpData'

export function HelpModule() {
  return (
    <HomeModuleCard
      title="找人帮忙"
      subtitle="升级通道"
      owner="长辈端求助负责人"
      path="src/features/elder-help"
      actionLabel="进入帮助页"
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
      <p className="module-hint">联系人、人工服务和紧急升级逻辑以后都收口到这个目录。</p>
    </HomeModuleCard>
  )
}
