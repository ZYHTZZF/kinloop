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
        <div>
          <p className="app-shell__eyebrow">Kinloop · 家人端</p>
          <h1>先判断今天发生了什么，再决定怎么联系。</h1>
        </div>
        <Link className="app-shell__switch-link" to="/elder/home">
          切换到长辈端
        </Link>
      </header>

      <div className="app-shell__content">
        <Outlet />
      </div>

      <BottomTabNav items={familyNavItems} />
    </div>
  )
}
