import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomTabNav } from '../../components/common/BottomTabNav'

const familyNavItems = [
  { to: '/family/today', label: '今天' },
  { to: '/family/chats', label: '聊天' },
  { to: '/family/memories', label: '回忆' },
  { to: '/family/collaboration', label: '协作' },
]

export function FamilyAppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="app-shell app-shell--family">
      <header className="app-shell__header">
        <div className="app-shell__header-copy">
          <p className="app-shell__eyebrow">Kinloop · 家人端</p>
          <h1>先判断今天发生了什么，再决定现在怎么联系。</h1>
        </div>
        <div className="app-shell__header-actions">
          <button className="ghost-action" type="button" onClick={() => handleGoBack()}>
            返回上一页
          </button>
          <Link className="ghost-action ghost-action--link" to="/family/today">
            回到今天
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

  function handleGoBack() {
    if (window.history.length > 1 && location.pathname !== '/family/today') {
      navigate(-1)
      return
    }

    navigate('/family/today')
  }
}
