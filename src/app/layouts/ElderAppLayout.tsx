import { Link, Outlet } from 'react-router-dom'
import { BottomTabNav } from '../../components/common/BottomTabNav'
import { GlobalVoiceButton } from '../../components/common/GlobalVoiceButton'

const elderNavItems = [
  { to: '/elder/home', label: '陪伴' },
  { to: '/elder/contacts', label: '联络' },
  { to: '/elder/memories', label: '回忆' },
  { to: '/elder/help', label: '求助' },
]

export function ElderAppLayout() {
  return (
    <div className="app-shell app-shell--elder">
      <header className="app-shell__header">
        <div>
          <p className="app-shell__eyebrow">Kinloop · 长辈端</p>
          <h1>让想说的话，更容易被家人接住。</h1>
        </div>
        <Link className="app-shell__switch-link" to="/family/today">
          切换到家人端
        </Link>
      </header>

      <div className="app-shell__content">
        <Outlet />
      </div>

      <GlobalVoiceButton label="按住说话 / 全局" />
      <BottomTabNav items={elderNavItems} />
    </div>
  )
}
