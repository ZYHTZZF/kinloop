import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomTabNav } from '../../components/common/BottomTabNav'
import { getCurrentWeather } from '../../services/api'
import { clearOnboardingState, getOnboardingState } from '../onboardingStorage'

const familyNavItems = [
  { to: '/family/today', label: '今日' },
  { to: '/family/chats', label: '聊天' },
  { to: '/family/memories', label: '回忆' },
  { to: '/family/collaboration', label: '协作' },
]

export function FamilyAppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const onboarding = getOnboardingState()
  const familyCode = onboarding.familyCode
  const isConversationRoute = /^\/family\/chats\/[^/]+$/.test(location.pathname)
  const showBottomNav = !isConversationRoute
  const [weatherLabel, setWeatherLabel] = useState('天气加载中')
  const [temperatureLabel, setTemperatureLabel] = useState('--°C')

  useEffect(() => {
    let cancelled = false

    async function loadWeather() {
      try {
        const weather = await getCurrentWeather('武汉')
        if (!cancelled) {
          setWeatherLabel(`${weather.city} ${weather.weatherLabel}`)
          setTemperatureLabel(weather.temperatureLabel)
        }
      } catch {
        if (!cancelled) {
          setWeatherLabel('武汉 天气待更新')
          setTemperatureLabel('--°C')
        }
      }
    }

    void loadWeather()
    const timer = window.setInterval(() => {
      void loadWeather()
    }, 30 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())

  return (
    <div className={`app-shell app-shell--family${isConversationRoute ? ' app-shell--conversation' : ''}`}>
      {!isConversationRoute ? (
        <header className="app-shell__header">
          <div className="app-shell__header-copy">
            <p className="app-shell__eyebrow">{onboarding.familyName || 'Kinloop 家庭'}</p>
            <h1>{todayLabel}</h1>
            <div className="elder-header__weather">
              <span className="status-pill">{weatherLabel}</span>
              <span className="status-pill">{temperatureLabel}</span>
            </div>
            {familyCode ? <p className="app-shell__subtle">家庭加入码：{familyCode}</p> : null}
          </div>

          <div className="app-shell__header-actions">
            <Link className="ghost-action ghost-action--link" to="/family/collaboration">
              家庭协作
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
      ) : null}

      <div className="app-shell__content">
        <Outlet />
        {showBottomNav ? <BottomTabNav items={familyNavItems} /> : null}
      </div>
    </div>
  )
}
