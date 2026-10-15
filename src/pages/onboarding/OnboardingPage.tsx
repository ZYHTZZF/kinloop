import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  type BoundFamilyMember,
  type OnboardingAuthMode,
  type OnboardingFamilyMode,
  type OnboardingRole,
  getOnboardingState,
  getPreferredHomePath,
  saveOnboardingState,
} from '../../app/onboardingStorage'

type Stage = 'auth' | 'role' | 'family'

type DirectoryMember = BoundFamilyMember & {
  phone: string
}

const roleCards: Array<{ id: OnboardingRole; title: string; tags: string[] }> = [
  { id: 'elder', title: '我是长辈', tags: ['语音优先', '轻量操作', '陪伴视角'] },
  { id: 'family', title: '我是家人', tags: ['状态看板', '今日行动', '快速跟进'] },
  { id: 'caregiver', title: '我是照护协作者', tags: ['协作分工', '任务流', '成员管理'] },
]

const memberDirectory: DirectoryMember[] = [
  { id: 'ELD-1001', name: '汤老先生', role: 'elder', relation: '长辈', note: '更偏好语音沟通', phone: '13800001111' },
  { id: 'FAM-2001', name: '大女儿', role: 'family', relation: '家人', note: '本周联系稳定', phone: '13800002222' },
  { id: 'FAM-2002', name: '儿子', role: 'family', relation: '家人', note: '适合周末接力', phone: '13800003333' },
  { id: 'CAR-3001', name: '王护理师', role: 'caregiver', relation: '照护协作者', note: '负责白天协助', phone: '13800004444' },
]

const stageLabels: Array<[Stage, string]> = [
  ['auth', '登录账户'],
  ['role', '选择身份'],
  ['family', '绑定家庭'],
]

const stageTagMap: Record<Stage, string[]> = {
  auth: ['登录', '账号信息', '继续进入'],
  role: ['身份选择', '默认视角', '可切换'],
  family: ['创建家庭', '加入家庭', '成员绑定'],
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const stored = useMemo(() => getOnboardingState(), [])

  const [stage, setStage] = useState<Stage>(() => (stored.completedAt ? 'family' : stored.role ? 'family' : 'auth'))
  const [authMode, setAuthMode] = useState<OnboardingAuthMode>(stored.authMode)
  const [account, setAccount] = useState(stored.account)
  const [secret, setSecret] = useState('')
  const [role, setRole] = useState<OnboardingRole | null>(stored.role)
  const [familyMode, setFamilyMode] = useState<OnboardingFamilyMode>(stored.familyMode)
  const [familyId, setFamilyId] = useState(stored.familyId)
  const [familyName, setFamilyName] = useState(stored.familyName)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [members, setMembers] = useState<BoundFamilyMember[]>(stored.members)
  const [error, setError] = useState('')

  const roleLabel = role === 'elder' ? '长辈' : role === 'family' ? '家人' : role === 'caregiver' ? '照护协作者' : '未选择'
  const nextPath = new URLSearchParams(location.search).get('next')

  const searchResults = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    const boundIds = new Set(members.map((member) => member.id))

    return memberDirectory.filter((member) => {
      if (boundIds.has(member.id)) return false
      if (!keyword) return true
      const haystack = [member.id, member.name, member.phone, member.relation].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [members, searchKeyword])

  function handleAuthContinue() {
    if (!account.trim() || !secret.trim()) {
      setError('请填写账号和密码/验证码后继续。')
      return
    }

    setError('')
    setStage('role')
  }

  function handleRoleContinue() {
    if (!role) {
      setError('请先选择身份。')
      return
    }

    setError('')
    setStage('family')
  }

  function chooseFamilyMode(nextMode: OnboardingFamilyMode) {
    setFamilyMode(nextMode)
    setError('')

    if (nextMode === 'create') {
      setFamilyId(`KIN-${Math.floor(1000 + Math.random() * 9000)}`)
      setFamilyName(role === 'elder' ? '银龄相伴之家' : 'Kinloop 家庭')
      return
    }

    if (nextMode === 'skip') {
      setFamilyId('')
      setFamilyName('未绑定家庭')
      setMembers([])
    }
  }

  function handleJoinFamily() {
    if (!familyId.trim()) {
      setError('请输入家庭 ID。')
      return
    }

    setFamilyMode('join')
    setFamilyId(familyId.trim().toUpperCase())
    if (!familyName || familyName === '未绑定家庭') {
      setFamilyName('晨光家庭')
    }
    setError('')
  }

  function bindMember(member: DirectoryMember) {
    setMembers((current) => [...current, member])
  }

  function handleFinish() {
    if (!role) {
      setError('还没有选择身份。')
      return
    }

    if (familyMode === 'idle') {
      setError('请选择绑定方式。')
      return
    }

    if (familyMode === 'join' && !familyId.trim()) {
      setError('加入家庭需要家庭 ID。')
      return
    }

    saveOnboardingState({
      isAuthenticated: true,
      authMode,
      account: account.trim(),
      role,
      familyMode,
      familyId: familyId.trim(),
      familyName: familyName.trim() || '未绑定家庭',
      members,
      completedAt: Date.now(),
    })

    navigate(nextPath || getPreferredHomePath(), { replace: true })
  }

  return (
    <main className="welcome-shell">
      <div className="welcome-shell__backdrop" aria-hidden="true" />
      <section className="welcome-card">
        <div className="welcome-card__intro">
          <span className="welcome-kicker">进入 Kinloop</span>
          <h1>登录后继续使用 Kinloop</h1>
          <div className="welcome-tag-row">
            {stageTagMap[stage].map((tag) => (
              <span className="welcome-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="welcome-steps" aria-label="引导步骤">
          {stageLabels.map(([id, label], index) => (
            <div
              key={id}
              className={[
                'welcome-step',
                stage === id ? 'is-active' : '',
                (stage === 'role' && index === 0) || stage === 'family' ? 'is-done' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>

        {error ? <p className="welcome-error">{error}</p> : null}

        {stage === 'auth' ? (
          <section className="welcome-panel">
            <div className="welcome-panel__header">
              <div>
                <span className="welcome-kicker">账户</span>
                <h2>{authMode === 'login' ? '欢迎回来' : '创建账户'}</h2>
              </div>
              <div className="welcome-tabs">
                <button className={authMode === 'login' ? 'is-active' : ''} type="button" onClick={() => setAuthMode('login')}>
                  登录
                </button>
                <button className={authMode === 'register' ? 'is-active' : ''} type="button" onClick={() => setAuthMode('register')}>
                  注册
                </button>
              </div>
            </div>

            <div className="welcome-form-grid">
              <label className="welcome-field">
                <span>手机号 / 邮箱</span>
                <input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="输入账号" />
              </label>
              <label className="welcome-field">
                <span>{authMode === 'login' ? '密码' : '验证码 / 密码'}</span>
                <input
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder={authMode === 'login' ? '输入密码' : '输入验证码或密码'}
                  type="password"
                />
              </label>
            </div>

            <div className="welcome-actions">
              <button className="welcome-primary" type="button" onClick={handleAuthContinue}>
                下一步
              </button>
            </div>
          </section>
        ) : null}

        {stage === 'role' ? (
          <section className="welcome-panel">
            <div className="welcome-panel__header">
              <div>
                <span className="welcome-kicker">身份</span>
                <h2>当前主要身份</h2>
              </div>
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

            <div className="welcome-actions">
              <button className="welcome-secondary" type="button" onClick={() => setStage('auth')}>
                上一步
              </button>
              <button className="welcome-primary" type="button" onClick={handleRoleContinue}>
                下一步
              </button>
            </div>
          </section>
        ) : null}

        {stage === 'family' ? (
          <section className="welcome-panel">
            <div className="welcome-panel__header">
              <div>
                <span className="welcome-kicker">家庭</span>
                <h2>绑定方式</h2>
              </div>
              <div className="welcome-badge">{roleLabel}</div>
            </div>

            <div className="family-mode-grid">
              <button className={familyMode === 'create' ? 'is-active' : ''} type="button" onClick={() => chooseFamilyMode('create')}>
                创建家庭
              </button>
              <button className={familyMode === 'join' ? 'is-active' : ''} type="button" onClick={() => chooseFamilyMode('join')}>
                加入家庭
              </button>
              <button className={familyMode === 'skip' ? 'is-active' : ''} type="button" onClick={() => chooseFamilyMode('skip')}>
                稍后绑定
              </button>
            </div>

            <div className="family-binding-grid">
              <article className="family-binding-card">
                {familyMode === 'create' ? (
                  <>
                    <strong>新家庭已生成</strong>
                    <div className="family-id-box">
                      <span>家庭 ID</span>
                      <strong>{familyId}</strong>
                    </div>
                    <label className="welcome-field">
                      <span>家庭名称</span>
                      <input value={familyName} onChange={(event) => setFamilyName(event.target.value)} />
                    </label>
                  </>
                ) : null}

                {familyMode === 'join' ? (
                  <>
                    <strong>输入家庭 ID</strong>
                    <label className="welcome-field">
                      <span>家庭 ID</span>
                      <input value={familyId} onChange={(event) => setFamilyId(event.target.value)} placeholder="例如 KIN-2038" />
                    </label>
                    <label className="welcome-field">
                      <span>家庭备注名</span>
                      <input value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="例如 晨光家庭" />
                    </label>
                    <button className="welcome-secondary welcome-secondary--block" type="button" onClick={handleJoinFamily}>
                      确认加入
                    </button>
                  </>
                ) : null}

                {familyMode === 'skip' ? <strong>稍后在协作页补绑</strong> : null}
                {familyMode === 'idle' ? <strong>先选择一种绑定方式</strong> : null}
              </article>

              <article className="family-binding-card family-binding-card--directory">
                <div className="family-board__head">
                  <div>
                    <span className="welcome-kicker">成员</span>
                    <strong>{familyName || '未绑定家庭'}</strong>
                  </div>
                  <span>{members.length} 位已绑定</span>
                </div>

                {familyMode === 'skip' ? (
                  <p className="family-board__hint">当前为稍后绑定模式</p>
                ) : (
                  <>
                    <label className="welcome-field">
                      <span>搜索成员</span>
                      <input
                        value={searchKeyword}
                        onChange={(event) => setSearchKeyword(event.target.value)}
                        placeholder="成员 ID / 姓名 / 手机号"
                      />
                    </label>

                    <div className="binding-result-list">
                      {searchResults.slice(0, 4).map((member) => (
                        <article className="binding-result-card" key={member.id}>
                          <div>
                            <strong>{member.name}</strong>
                            <p>
                              {member.id} · {member.relation}
                            </p>
                            <span>{member.note}</span>
                          </div>
                          <button className="welcome-secondary" type="button" onClick={() => bindMember(member)}>
                            绑定
                          </button>
                        </article>
                      ))}
                    </div>

                    <div className="bound-member-list">
                      {members.length === 0 ? (
                        <p className="family-board__hint">尚未绑定成员</p>
                      ) : (
                        members.map((member) => (
                          <div className="bound-member-chip" key={member.id}>
                            <strong>{member.name}</strong>
                            <span>{member.relation}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </article>
            </div>

            <div className="welcome-actions">
              <button className="welcome-secondary" type="button" onClick={() => setStage('role')}>
                上一步
              </button>
              <button className="welcome-primary" type="button" onClick={handleFinish}>
                进入系统
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}
