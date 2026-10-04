import { Link, Outlet } from 'react-router-dom'
import { BottomTabNav } from '../../components/common/BottomTabNav'

const familyNavItems = [
  { to: '/family/today', label: '今天' },
  { to: '/family/chats', label: '聊天' },
  { to: '/family/memories', label: '回忆' },
  { to: '/family/collaboration', label: '协作' },
]

export function FamilyAppLayout() {
  return (
    <div className="app-shell app-shell--family">
      <header className="app-shell__header">
        <div className="app-shell__header-copy">
          <p className="app-shell__eyebrow">Kinloop · 家人端</p>
          <h1>长辈最近状态</h1>
        </div>

        <div className="app-shell__header-actions">
          <Link className="app-shell__switch-link" to="/elder/home">
            切换到长辈端
          </Link>
        </div>
      </header>

      <div className="app-shell__content">
        <Outlet />
        <BottomTabNav items={familyNavItems} />
      </div>
    </div>
  )
}
