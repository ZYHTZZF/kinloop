import { useState } from 'react'
import { WorkspaceShell } from '../components/layout/WorkspaceShell'
import { ElderHomePage } from '../pages/elder/ElderHomePage'
import { FamilyHomePage } from '../pages/family/FamilyHomePage'
import { EchoEntryPage } from '../features/elder-echo/components/EchoEntryPage'
import { HelpEntryPage } from '../features/elder-help/components/HelpEntryPage'
import { TalkEntryPage } from '../features/elder-talk/components/TalkEntryPage'
import { CareTodayEntryPage } from '../features/family-care/components/CareTodayEntryPage'
import { ContinueCareEntryPage } from '../features/family-followup/components/ContinueCareEntryPage'
import { RecentStatusEntryPage } from '../features/family-status/components/RecentStatusEntryPage'
import type { ElderFeatureId, ElderModuleId, FamilyFeatureId, FamilyModuleId, SiteView } from './types'
import './app.css'

const viewOptions: Array<{ id: SiteView; label: string; note: string }> = [
  { id: 'elder', label: '长辈端', note: '说一说、回音、找人帮忙' },
  { id: 'family', label: '子女端', note: '今日关怀、最近状态、继续关心' },
]

const elderTitles: Record<ElderModuleId, string> = {
  home: '长辈端首页骨架',
  talk: '长辈端 · 说一说',
  echo: '长辈端 · 回音',
  help: '长辈端 · 找人帮忙',
}

const familyTitles: Record<FamilyModuleId, string> = {
  home: '子女端首页骨架',
  care: '子女端 · 今日关怀',
  status: '子女端 · 最近状态',
  followup: '子女端 · 继续关心',
}

const elderSubtitles: Record<ElderModuleId, string> = {
  home: '首页只负责摆放入口，点进去之后由各模块自己维护。',
  talk: 'AI 对话相关代码后续只需要继续在对话模块内开发。',
  echo: '回音相关的数据结构和页面交互后续只需要继续在回音模块内开发。',
  help: '求助入口和升级逻辑后续只需要继续在求助模块内开发。',
}

const familySubtitles: Record<FamilyModuleId, string> = {
  home: '首页只负责摆放入口，点进去之后由各模块自己维护。',
  care: '关怀建议和开口话术后续只需要继续在关怀模块内开发。',
  status: '状态摘要和联系原因后续只需要继续在状态模块内开发。',
  followup: '回填和回访闭环后续只需要继续在回访模块内开发。',
}

function App() {
  const [view, setView] = useState<SiteView>('elder')
  const [elderModule, setElderModule] = useState<ElderModuleId>('home')
  const [familyModule, setFamilyModule] = useState<FamilyModuleId>('home')

  const title = view === 'elder' ? elderTitles[elderModule] : familyTitles[familyModule]
  const subtitle = view === 'elder' ? elderSubtitles[elderModule] : familySubtitles[familyModule]

  return (
    <WorkspaceShell
      activeView={view}
      onViewChange={setView}
      viewOptions={viewOptions}
      title={title}
      subtitle={subtitle}
    >
      {view === 'elder'
        ? renderElderView(elderModule, setElderModule)
        : renderFamilyView(familyModule, setFamilyModule)}
    </WorkspaceShell>
  )
}

function renderElderView(
  module: ElderModuleId,
  setModule: (next: ElderModuleId) => void,
) {
  if (module === 'home') {
    return (
      <ElderHomePage
        onOpenTalk={() => setModule('talk')}
        onOpenEcho={() => setModule('echo')}
        onOpenHelp={() => setModule('help')}
      />
    )
  }

  return renderElderFeature(module, () => setModule('home'))
}

function renderElderFeature(
  feature: ElderFeatureId,
  onBack: () => void,
) {
  if (feature === 'talk') return <TalkEntryPage onBack={onBack} />
  if (feature === 'echo') return <EchoEntryPage onBack={onBack} />
  return <HelpEntryPage onBack={onBack} />
}

function renderFamilyView(
  module: FamilyModuleId,
  setModule: (next: FamilyModuleId) => void,
) {
  if (module === 'home') {
    return (
      <FamilyHomePage
        onOpenCare={() => setModule('care')}
        onOpenStatus={() => setModule('status')}
        onOpenFollowup={() => setModule('followup')}
      />
    )
  }

  return renderFamilyFeature(module, () => setModule('home'))
}

function renderFamilyFeature(
  feature: FamilyFeatureId,
  onBack: () => void,
) {
  if (feature === 'care') return <CareTodayEntryPage onBack={onBack} />
  if (feature === 'status') return <RecentStatusEntryPage onBack={onBack} />
  return <ContinueCareEntryPage onBack={onBack} />
}

export default App
