import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { BottomTabNav } from '../../components/common/BottomTabNav'
import { ElderVoiceAssistant } from '../../components/elder/ElderVoiceAssistant'
import { getElderGreetingSummary } from '../../utils/elderHeader'

const elderNavItems = [
  { to: '/elder/home', label: '首页' },
  { to: '/elder/inbox', label: '来信' },
]

export function ElderAppLayout() {
  const [headerSummary, setHeaderSummary] = useState(() => getElderGreetingSummary())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeaderSummary(getElderGreetingSummary())
    }, 60 * 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="app-shell app-shell--elder">
      <header className="app-shell__header">
        <div className="app-shell__header-copy">
          <p className="app-shell__eyebrow">Kinloop · 长辈端</p>
          <h1>{headerSummary.greeting}</h1>
          <div className="elder-header__weather">
            <span className="status-pill">{headerSummary.weatherLabel}</span>
            <span className="status-pill">{headerSummary.temperatureLabel}</span>
          </div>
          <p className="elder-header__advice">{headerSummary.advice}</p>
        </div>
        <div className="app-shell__header-actions">
          <Link className="ghost-action ghost-action--link" to="/elder/home">
            回到首页
          </Link>
          <Link className="app-shell__switch-link" to="/family/today">
            切换到家人端
          </Link>
        </div>
      </header>

      <div className="app-shell__content">
        <Outlet />
      </div>

      <ElderVoiceAssistant />
      <Link className="manual-help-link" to="/elder/help">
        紧急求助
      </Link>
      <BottomTabNav items={elderNavItems} />
    </div>
  )
}
