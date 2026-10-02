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
          <h1>先看长辈今天的状态，再决定现在要不要发消息或打电话。</h1>
        </div>

        <div className="app-shell__header-actions">
          <Link className="primary-action" to="/family/chats">
            去聊天窗口
          </Link>
          <Link className="app-shell__switch-link" to="/elder/home">
            切换到长辈端
          </Link>
        </div>
      </header>

      <div className="app-shell__content">
        <Outlet />
      </div>

      <BottomTabNav items={familyNavItems} />
    </div>
  )
}
