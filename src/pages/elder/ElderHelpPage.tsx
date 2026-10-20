import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ElderVoiceIntentResult } from '../../domain/elderVoice'
import { escalationSteps, helpActions, helpRequests } from '../../domain/content/helpGuidance'
import { createAlert, listActiveAlerts } from '../../services/api'
import type { Alert } from '../../services/api'
import { formatShortDateTime } from '../../utils/dateTime'

export function ElderHelpPage() {
  const location = useLocation()
  const voiceResult = location.state?.elderVoiceResult as ElderVoiceIntentResult | undefined
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [creatingType, setCreatingType] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const nextAlerts = await listActiveAlerts()
        if (!cancelled) {
          setAlerts(nextAlerts)
          setError('')
        }
      } catch {
        if (!cancelled) {
          setError('暂时还没有更新到最新求助状态，请稍后再试。')
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="screen screen--elder-help">
      <section className="surface-card surface-card--help">
        <div className="section-heading">
          <div>
            <p className="surface-card__eyebrow">求助</p>
            <h2>如果你现在需要人帮忙，先点这里。</h2>
          </div>
          <Link className="ghost-action ghost-action--link" to="/elder/home">
            回到首页
          </Link>
        </div>

        {voiceResult ? <p className="state-note">{voiceResult.promptTitle}</p> : null}

        <div className="help-stack">
          {helpActions.map((action) => (
            <button
              key={action.label}
              className={`help-card ${action.tone === 'primary' ? 'help-card--danger' : 'help-card--neutral'}`}
              type="button"
              disabled={creatingType === action.label}
              onClick={() => void handleCreateFromAction(action.label)}
            >
              <strong>{action.label}</strong>
              <span>{action.description}</span>
              {action.tone === 'primary' ? (
                <div className="sos-progress" aria-hidden="true">
                  <span className="sos-progress__fill" />
                </div>
              ) : null}
            </button>
          ))}

          <button
            className="help-card help-card--warn"
            type="button"
            disabled={creatingType === 'unwell'}
            onClick={() => void handleCreateUnwell()}
          >
            <strong>我现在不舒服</strong>
            <span>会提醒家人尽快关注你。</span>
          </button>
        </div>

        {error ? <p className="state-note state-note--error">{error}</p> : null}
        {feedback ? <p className="state-note">{feedback}</p> : null}

        <div className="split-grid">
          <article className="support-card">
            <p className="surface-card__eyebrow">当前进展</p>
            <div className="list-stack">
              {alerts.length > 0
                ? alerts.map((alert) => (
                    <div className="signal-row" key={alert.id}>
                      <strong>{alert.alertType === 'SOS' ? '紧急求助' : '需要尽快联系'}</strong>
                      <p>{toAlertDescription(alert)}</p>
                      <small>{formatShortDateTime(alert.triggeredAt)}</small>
                    </div>
                  ))
                : helpRequests.slice(0, 3).map((request) => (
                    <div className="signal-row" key={request.id}>
                      <strong>{request.title}</strong>
                      <p>{request.summary}</p>
                      <small>{request.lastUpdate}</small>
                    </div>
                  ))}
            </div>
          </article>

          <article className="support-card">
            <p className="surface-card__eyebrow">处理方式</p>
            <div className="list-stack">
              {escalationSteps.map((step) => (
                <div className="signal-row" key={step.label}>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </section>
  )

  async function handleCreateFromAction(label: string) {
    if (label === '紧急升级') {
      await createAlertForType('SOS', 'Button', '已经通知家人，会优先处理这次求助。')
      return
    }

    await createAlertForType('UNWELL', 'Button', `已经记下“${label}”，家人会尽快联系你。`)
  }

  async function handleCreateUnwell() {
    await createAlertForType('UNWELL', 'Button', '已经提醒家人，请他们尽快联系你。')
  }

  async function createAlertForType(alertType: 'SOS' | 'UNWELL', triggerSource: 'Button' | 'Voice', successText: string) {
    try {
      setCreatingType(alertType === 'SOS' ? '紧急升级' : 'unwell')
      await createAlert({
        familySpaceId: 'fs_demo',
        alertType,
        triggerSource,
        escalationLevel: alertType === 'SOS' ? 2 : 1,
      })
      const nextAlerts = await listActiveAlerts()
      setAlerts(nextAlerts)
      setFeedback(successText)
      setError('')
    } catch {
      setError('这次求助暂时没有发出去，请再试一次。')
    } finally {
      setCreatingType(null)
    }
  }
}

function toAlertDescription(alert: Alert) {
  if (alert.status === 'HANDLING') {
    return '已经有人在跟进了。'
  }

  if (alert.status === 'TRIGGERED') {
    return '刚刚发出，正在等家人查看。'
  }

  return '家人已收到提醒。'
}
