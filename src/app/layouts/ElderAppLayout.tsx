import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ElderVoiceAssistant } from '../../components/elder/ElderVoiceAssistant'
import { getCurrentWeather } from '../../services/api'
import { getElderGreeting, getFallbackElderGreetingSummary } from '../../utils/elderHeader'
import { clearOnboardingState, getOnboardingState } from '../onboardingStorage'

export function ElderAppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [headerSummary, setHeaderSummary] = useState(() => getFallbackElderGreetingSummary())
  const onboarding = getOnboardingState()
  const isConversationRoute = /^\/elder\/conversations\/[^/]+$/.test(location.pathname)

  useEffect(() => {
    let cancelled = false

    async function loadWeather() {
      try {
        const weather = await getCurrentWeather('武汉')

        if (!cancelled) {
          setHeaderSummary({
            greeting: getElderGreeting(),
            locationLabel: weather.city,
            weatherLabel: weather.weatherLabel,
            temperatureLabel: weather.temperatureLabel,
            advice: weather.advice,
          })
        }
      } catch {
        if (!cancelled) {
          setHeaderSummary(getFallbackElderGreetingSummary())
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

  return (
    <div className={`app-shell app-shell--elder${isConversationRoute ? ' app-shell--conversation' : ''}`}>
      {!isConversationRoute ? (
        <header className="app-shell__header">
          <div className="app-shell__header-copy">
            <p className="app-shell__eyebrow">{onboarding.familyName || 'Kinloop 家庭'}</p>
            <h1>{headerSummary.greeting}</h1>
            <div className="elder-header__weather">
              <span className="status-pill">{headerSummary.locationLabel}</span>
              <span className="status-pill">{headerSummary.weatherLabel}</span>
              <span className="status-pill">{headerSummary.temperatureLabel}</span>
            </div>
            <p className="elder-header__advice">{headerSummary.advice}</p>
          </div>
          <div className="app-shell__header-actions">
            <Link className="ghost-action ghost-action--link" to="/elder/home">
              回到首页
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
      </div>

      <ElderVoiceAssistant />
      {!isConversationRoute ? (
        <Link className="manual-help-link" to="/elder/help">
          需要帮助
        </Link>
      ) : null}
    </div>
  )
}
