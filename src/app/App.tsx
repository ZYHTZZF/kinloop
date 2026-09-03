import { useState } from 'react'
import { WorkspaceShell } from '../components/layout/WorkspaceShell'
import { ElderHomePage } from '../pages/elder/ElderHomePage'
import { FamilyHomePage } from '../pages/family/FamilyHomePage'
import type { SiteView } from './types'
import './app.css'

const viewOptions: Array<{ id: SiteView; label: string; note: string }> = [
  { id: 'elder', label: '长辈端', note: '表达、回音、求助' },
  { id: 'family', label: '子女端', note: '关怀、状态、回访' },
] as const

function App() {
  const [view, setView] = useState<SiteView>('elder')

  return (
    <WorkspaceShell
      activeView={view}
      onViewChange={setView}
      viewOptions={viewOptions}
      title={view === 'elder' ? '长辈端首页骨架' : '子女端首页骨架'}
      subtitle="首页只负责组装模块，具体业务留在各自目录里。"
    >
      {view === 'elder' ? <ElderHomePage /> : <FamilyHomePage />}
    </WorkspaceShell>
  )
}

export default App
