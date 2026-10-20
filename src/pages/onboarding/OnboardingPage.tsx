import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getCurrentSession, loginAccount, registerAccount, resetPassword, sendAuthCode } from '../../services/api'
import {
  type OnboardingAuthMode,
  type OnboardingFamilyMode,
  type OnboardingRole,
  getPreferredHomePath,
  getStoredAuthToken,
  saveAuthSession,
} from '../../app/onboardingStorage'

const roleCards: Array<{ id: OnboardingRole; title: string; tags: string[] }> = [
  { id: 'elder', title: '我是长辈', tags: ['语音优先', '大字更清楚', '陪伴更简单'] },
  { id: 'family', title: '我是家人', tags: ['关注状态', '随时聊天', '日常跟进'] },
  { id: 'caregiver', title: '我是照护者', tags: ['协同照护', '任务分工', '成员协作'] },
]

const familyModeCards: Array<{ id: OnboardingFamilyMode; title: string; description: string }> = [
  { id: 'create', title: '创建家庭', description: '我是第一个加入的人，先创建一个新的家庭空间。' },
  { id: 'join', title: '加入家庭', description: '我已经拿到家庭加入码，直接加入现有家庭。' },
]

function toFriendlyError(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message.trim()) {
    return fallback
  }

  const message = error.message

  if (/network|fetch|failed to fetch|timeout|ws|socket/i.test(message)) {
    return '网络有点不稳定，请稍后再试。'
  }

  if (/code|验证码/i.test(message)) {
    return '验证码有误或已过期，请重新获取。'
  }

  if (/password|密码/i.test(message)) {
    return '密码不正确，请重新输入。'
  }

  if (/email|邮箱/i.test(message)) {
    return '邮箱格式或状态有误，请检查后重试。'
  }

  return fallback
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const nextPath = new URLSearchParams(location.search).get('next')

  const [mode, setMode] = useState<OnboardingAuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [relationLabel, setRelationLabel] = useState('')
  const [role, setRole] = useState<OnboardingRole>('family')
  const [familyMode, setFamilyMode] = useState<OnboardingFamilyMode>('create')
  const [familyName, setFamilyName] = useState('')
  const [familyCode, setFamilyCode] = useState('')

  useEffect(() => {
    const token = getStoredAuthToken()
    if (!token) return

    void (async () => {
      try {
        const session = await getCurrentSession()
        saveAuthSession(session)
        navigate(nextPath || session.homePath || getPreferredHomePath(), { replace: true })
      } catch {
        // Ignore stale token.
      }
    })()
  }, [navigate, nextPath])

  function setNotice(nextMessage = '', nextError = '') {
    setMessage(nextMessage)
    setError(nextError)
  }

  async function handleSendCode() {
    if (!email.trim()) {
      setNotice('', '请先输入邮箱。')
      return
    }

    setLoading(true)
    setNotice('', '')
    try {
      const result = await sendAuthCode(email.trim(), mode === 'forgot' ? 'reset_password' : 'register')
      if (result.devCode) {
        setCode(result.devCode)
      }
      setNotice('验证码已发送，请查看邮箱并填写。', '')
    } catch (sendError) {
      setNotice('', toFriendlyError(sendError, '验证码发送失败，请稍后再试。'))
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      setNotice('', '请输入邮箱和密码。')
      return
    }

    setLoading(true)
    setNotice('', '')
    try {
      const session = await loginAccount({ email: email.trim(), password })
      saveAuthSession(session)
      navigate(nextPath || session.homePath || getPreferredHomePath(), { replace: true })
    } catch (loginError) {
      setNotice('', toFriendlyError(loginError, '登录失败，请检查后重试。'))
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister() {
    if (!displayName.trim()) {
      setNotice('', '请填写称呼。')
      return
    }
    if (!email.trim() || !code.trim()) {
      setNotice('', '请填写邮箱和验证码。')
      return
    }
    if (password.length < 8) {
      setNotice('', '密码至少需要 8 位。')
      return
    }
    if (password !== confirmPassword) {
      setNotice('', '两次输入的密码不一致。')
      return
    }
    if (familyMode === 'create' && !familyName.trim()) {
      setNotice('', '请填写家庭名称。')
      return
    }
    if (familyMode === 'join' && !familyCode.trim()) {
      setNotice('', '请输入家庭加入码。')
      return
    }

    setLoading(true)
    setNotice('', '')
    try {
      const session = await registerAccount({
        email: email.trim(),
        code: code.trim(),
        password,
        role,
        familyAction: familyMode === 'join' ? 'join' : 'create',
        familyName: familyMode === 'create' ? familyName.trim() : undefined,
        familyCode: familyMode === 'join' ? familyCode.trim().toUpperCase() : undefined,
        displayName: displayName.trim(),
        relationLabel: relationLabel.trim() || undefined,
      })
      saveAuthSession(session)
      navigate(nextPath || session.homePath || getPreferredHomePath(), { replace: true })
    } catch (registerError) {
      setNotice('', toFriendlyError(registerError, '注册失败，请稍后再试。'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!email.trim() || !code.trim()) {
      setNotice('', '请填写邮箱和验证码。')
      return
    }
    if (password.length < 8) {
      setNotice('', '新密码至少需要 8 位。')
      return
    }
    if (password !== confirmPassword) {
      setNotice('', '两次输入的密码不一致。')
      return
    }

    setLoading(true)
    setNotice('', '')
    try {
      const session = await resetPassword({
        email: email.trim(),
        code: code.trim(),
        newPassword: password,
      })
      saveAuthSession(session)
      navigate(nextPath || session.homePath || getPreferredHomePath(), { replace: true })
    } catch (resetError) {
      setNotice('', toFriendlyError(resetError, '重置密码失败，请稍后再试。'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="welcome-shell">
      <div className="welcome-shell__backdrop" aria-hidden="true" />
      <section className="welcome-card">
        <div className="welcome-card__intro">
          <span className="welcome-kicker">Kinloop</span>
          <h1>欢迎来到 Kinloop</h1>
          <p>把家人的问候、回忆和照应，都放进一个更容易使用的空间里。</p>
        </div>

        <section className="welcome-panel">
          <div className="welcome-panel__header">
            <div>
              <span className="welcome-kicker">账号</span>
              <h2>{mode === 'login' ? '登录账号' : mode === 'register' ? '创建账号并加入家庭' : '找回密码'}</h2>
            </div>
            <div className="welcome-tabs">
              <button className={mode === 'login' ? 'is-active' : ''} type="button" onClick={() => setMode('login')}>
                登录
              </button>
              <button className={mode === 'register' ? 'is-active' : ''} type="button" onClick={() => setMode('register')}>
                注册
              </button>
              <button className={mode === 'forgot' ? 'is-active' : ''} type="button" onClick={() => setMode('forgot')}>
                找回密码
              </button>
            </div>
          </div>

          {message ? <p className="welcome-success">{message}</p> : null}
          {error ? <p className="welcome-error">{error}</p> : null}

          <div className="welcome-form-grid">
            <label className="welcome-field">
              <span>邮箱</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
            </label>
            <label className="welcome-field">
              <span>{mode === 'login' ? '密码' : mode === 'forgot' ? '新密码' : '设置密码'}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" />
            </label>
          </div>

          {mode !== 'login' ? (
            <div className="welcome-form-grid">
              <label className="welcome-field">
                <span>邮箱验证码</span>
                <div className="welcome-inline">
                  <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="输入验证码" />
                  <button className="welcome-secondary" type="button" onClick={handleSendCode} disabled={loading}>
                    发送验证码
                  </button>
                </div>
              </label>
              <label className="welcome-field">
                <span>确认密码</span>
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入密码" />
              </label>
            </div>
          ) : null}

          {mode === 'register' ? (
            <>
              <div className="welcome-form-grid">
                <label className="welcome-field">
                  <span>称呼</span>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如 王阿姨 / 大女儿" />
                </label>
                <label className="welcome-field">
                  <span>关系备注</span>
                  <input value={relationLabel} onChange={(event) => setRelationLabel(event.target.value)} placeholder="例如 长辈 / 女儿 / 护工" />
                </label>
              </div>

              <div className="role-choice-grid">
                {roleCards.map((card) => (
                  <button
                    key={card.id}
                    className={['role-choice-card', role === card.id ? 'is-active' : ''].filter(Boolean).join(' ')}
                    type="button"
                    onClick={() => setRole(card.id)}
                  >
                    <strong>{card.title}</strong>
                    <div className="welcome-tag-row">
                      {card.tags.map((tag) => (
                        <span className="welcome-tag welcome-tag--muted" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              <div className="family-mode-grid">
                {familyModeCards.map((item) => (
                  <button
                    key={item.id}
                    className={familyMode === item.id ? 'is-active' : ''}
                    type="button"
                    onClick={() => setFamilyMode(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>

              <div className="family-binding-grid">
                <article className="family-binding-card">
                  <strong>{familyMode === 'create' ? '创建新的家庭空间' : '输入家庭加入码'}</strong>
                  <p>{familyModeCards.find((item) => item.id === familyMode)?.description}</p>
                  {familyMode === 'create' ? (
                    <label className="welcome-field">
                      <span>家庭名称</span>
                      <input value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="例如 李阿姨一家" />
                    </label>
                  ) : (
                    <label className="welcome-field">
                      <span>家庭加入码</span>
                      <input value={familyCode} onChange={(event) => setFamilyCode(event.target.value)} placeholder="例如 KIN8A3P2" />
                    </label>
                  )}
                </article>

                <article className="family-binding-card family-binding-card--directory">
                  <span className="welcome-kicker">说明</span>
                  <strong>注册完成后，会自动进入适合你的首页。</strong>
                  <p>长辈账号会进入长辈端，家人和照护者会进入家属端。</p>
                  <p>如果一时没收到验证码，可以稍等片刻后重新发送。</p>
                </article>
              </div>
            </>
          ) : null}

          <div className="welcome-actions">
            {mode === 'login' ? (
              <button className="welcome-primary" type="button" onClick={handleLogin} disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </button>
            ) : null}

            {mode === 'register' ? (
              <button className="welcome-primary" type="button" onClick={handleRegister} disabled={loading}>
                {loading ? '注册中...' : '完成注册'}
              </button>
            ) : null}

            {mode === 'forgot' ? (
              <button className="welcome-primary" type="button" onClick={handleResetPassword} disabled={loading}>
                {loading ? '提交中...' : '重置密码'}
              </button>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  )
}
