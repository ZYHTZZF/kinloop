import { Link, Outlet } from 'react-router-dom'
import { BottomTabNav } from '../../components/common/BottomTabNav'
import { getOnboardingState } from '../onboardingStorage'

const familyNavItems = [
  { to: '/family/today', label: '今天' },
  { to: '/family/chats', label: '聊天' },
  { to: '/family/memories', label: '回忆' },
  { to: '/family/collaboration', label: '协作' },
]

export function FamilyAppLayout() {
  const onboarding = getOnboardingState()

  return (
    <div className="app-shell app-shell--family">
      <header className="app-shell__header">
        <div className="app-shell__header-copy">
          <p className="app-shell__eyebrow">{onboarding.familyName || 'Kinloop 家庭'}</p>
          <h1>今天先从最值得关心的变化开始。</h1>
        </div>

        <div className="app-shell__header-actions">
          <Link className="ghost-action ghost-action--link" to="/welcome">
            调整进入信息
          </Link>
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
