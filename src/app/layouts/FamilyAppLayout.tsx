import { Link, Outlet, useNavigate } from 'react-router-dom'
import { BottomTabNav } from '../../components/common/BottomTabNav'
import { clearOnboardingState, getOnboardingState } from '../onboardingStorage'

const familyNavItems = [
  { to: '/family/today', label: '今天' },
  { to: '/family/chats', label: '聊天' },
  { to: '/family/memories', label: '回忆' },
  { to: '/family/collaboration', label: '协作' },
]

export function FamilyAppLayout() {
  const navigate = useNavigate()
  const onboarding = getOnboardingState()
  const familyCode = onboarding.familyCode

  return (
    <div className="app-shell app-shell--family">
      <header className="app-shell__header">
        <div className="app-shell__header-copy">
          <p className="app-shell__eyebrow">{onboarding.familyName || 'Kinloop 家庭'}</p>
          <h1>今天先从最值得关心的变化开始。</h1>
          {familyCode ? (
            <p className="app-shell__eyebrow">
              家庭码：<strong>{familyCode}</strong>
            </p>
          ) : null}
        </div>

        <div className="app-shell__header-actions">
          <Link className="ghost-action ghost-action--link" to="/family/collaboration">
            查看家庭码
          </Link>
          <Link className="ghost-action ghost-action--link" to="/welcome">
            账号设置
          </Link>
          <button
            className="ghost-action ghost-action--link"
            type="button"
            onClick={() => {
              clearOnboardingState()
              navigate('/welcome', { replace: true })
            }}
          >
            退出登录
          </button>
        </div>
      </header>

      <div className="app-shell__content">
        <Outlet />
        <BottomTabNav items={familyNavItems} />
      </div>
    </div>
  )
}
