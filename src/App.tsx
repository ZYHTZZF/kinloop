import { useMemo, useState } from 'react'
import './App.css'

type Role = 'elder' | 'family' | 'caregiver'
type Stage = 'entry' | 'auth' | 'role' | 'family' | 'app'
type AuthMode = 'login' | 'register'
type FamilyMode = 'idle' | 'create' | 'join' | 'skip'
type FamilyPage = 'home' | 'members' | 'plan' | 'family-chat' | 'settings'
type ElderPage = 'home' | 'chat' | 'diary' | 'help' | 'settings'
type VoiceState = 'idle' | 'recording' | 'transcribing'

type Member = {
  name: string
  role: Role
  relation: string
  note: string
  tags: string[]
}

type OnboardingStep = 'auth' | 'role' | 'family'

const roleCards = [
  { id: 'elder', title: '我是长辈', text: '我希望被温和接住，也希望在需要时更容易联系家人。' },
  { id: 'family', title: '我是家人', text: '我想更自然地关心长辈，也希望知道今天最该做什么。' },
  { id: 'caregiver', title: '我是照护协作者', text: '这个端侧先保留接口，这一阶段只做独立入口占位。' },
] as const

const familyNav = [
  { id: 'home', label: '首页' },
  { id: 'members', label: '家庭成员' },
  { id: 'plan', label: '今日计划' },
  { id: 'family-chat', label: '我的家庭' },
  { id: 'settings', label: '设置' },
] as const

const elderNav = [
  { id: 'home', label: '首页' },
  { id: 'chat', label: '说说话' },
  { id: 'diary', label: '我的日记' },
  { id: 'help', label: '需要帮忙' },
  { id: 'settings', label: '设置' },
] as const

const joinHints = ['YL-2026-HOME', 'YL-2048-FAMILY', 'YL-8861-SILVER'] as const

const familyPlans = [
  { time: '20:10', title: '给妈妈发一段 30 秒语音', note: '先别急着问身体，先从“昨晚睡得怎么样”开始。' },
  { time: '明天中午', title: '发一句轻量问候', note: '比起突然打电话，她更容易接受短消息。' },
  { time: '周末', title: '安排一次视频通话', note: '最近视频之后，她更愿意继续表达。' },
] as const

const familyThreads = [
  { title: '我的家庭', badge: '家庭聊天', summary: '女儿：今晚我先来联系，结束后把结果回填。' },
  { title: '心语助手', badge: 'AI 助手', summary: '建议今晚先用短语音打开气氛，再轻轻追问睡眠。' },
] as const

const diaryEntries = [
  { date: '今天', title: '昨晚睡得还是浅', body: '半夜醒了两次，早上倒是看见窗台上有阳光。' },
  { date: '昨天', title: '想起以前一起去公园', body: '看到橙子的时候，想起以前你带我去买水果。' },
] as const

const chatPreview = [
  { who: '心语', text: '今天想先聊哪件事？我在。', type: 'ai' },
  { who: '我', text: '昨晚还是没太睡好。', type: 'user' },
  { who: '女儿', text: '妈，我下班晚一点，但一直记着你昨天说没睡好。', type: 'family' },
] as const

const makeMember = (name: string, role: Role, relation: string, note: string, tags: string[]): Member => ({
  name,
  role,
  relation,
  note,
  tags,
})

function App() {
  const [stage, setStage] = useState<Stage>('entry')
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [role, setRole] = useState<Role | null>(null)
  const [familyMode, setFamilyMode] = useState<FamilyMode>('idle')
  const [familyId, setFamilyId] = useState('')
  const [familyName, setFamilyName] = useState('我的家庭')
  const [joinId, setJoinId] = useState('')
  const [inviteRole, setInviteRole] = useState<Role | null>(null)
  const [inviteId, setInviteId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [familyPage, setFamilyPage] = useState<FamilyPage>('home')
  const [elderPage, setElderPage] = useState<ElderPage>('home')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')

  const me = useMemo(() => {
    if (role === 'elder') return makeMember('张阿姨', 'elder', '我自己', '今天适合慢一点聊天', ['轻度低落', '睡眠波动'])
    if (role === 'family') return makeMember('李晨', 'family', '女儿', '今晚由我主负责联系', ['本周已联系'])
    if (role === 'caregiver') return makeMember('护理顾问', 'caregiver', '照护协作者', '当前为预留接口', ['状态平稳'])
    return null
  }, [role])

  const allMembers = useMemo(() => {
    if (!me) return members
    return members.some((item) => item.name === me.name && item.role === me.role) ? members : [me, ...members]
  }, [me, members])

  const voiceLabel =
    voiceState === 'recording' ? '我在认真听，慢慢说。' : voiceState === 'transcribing' ? '我听见了，正在整理。' : '按住说话'

  const roleLabel = role === 'elder' ? '长辈' : role === 'family' ? '家人' : role === 'caregiver' ? '照护协作者' : ''

  const currentStep: OnboardingStep | null =
    stage === 'auth' ? 'auth' : stage === 'role' ? 'role' : stage === 'family' ? 'family' : null

  const enterApp = () => {
    if (!role || familyMode === 'idle') return
    setStage('app')
  }

  const createFamily = () => {
    if (!role) return
    setFamilyMode('create')
    setFamilyName('银龄之家')
    setFamilyId(`YL-${Math.floor(1000 + Math.random() * 9000)}-${role === 'elder' ? 'ELD' : role === 'family' ? 'FAM' : 'CARE'}`)
    setMembers([])
  }

  const joinFamily = () => {
    if (!joinId.trim()) return
    setFamilyMode('join')
    setFamilyId(joinId.trim().toUpperCase())
    setFamilyName('晨光家庭')
    const seed = [
      makeMember('张阿姨', 'elder', '长辈', '最近晚间更愿意表达', ['轻度低落', '待回访']),
      makeMember('李晨', 'family', '女儿', '今晚由我主负责联系', ['本周已联系']),
    ]
    setMembers(role === 'elder' ? seed.filter((item) => item.role !== 'elder') : role === 'family' ? seed.filter((item) => item.role !== 'family') : seed)
  }

  const addMember = () => {
    if (!inviteRole || !inviteId.trim()) return
    const next = inviteRole === 'elder'
      ? makeMember('陈阿姨', 'elder', '长辈', `通过 ${inviteId.toUpperCase()} 绑定`, ['状态平稳'])
      : inviteRole === 'family'
        ? makeMember('李航', 'family', '儿子', `通过 ${inviteId.toUpperCase()} 绑定`, ['本周已联系'])
        : makeMember('护理顾问', 'caregiver', '照护协作者', `通过 ${inviteId.toUpperCase()} 绑定`, ['状态平稳'])
    setMembers((prev) => [...prev, next])
    setInviteRole(null)
    setInviteId('')
  }

  const toggleVoice = () => {
    setVoiceState((prev) => prev === 'idle' ? 'recording' : prev === 'recording' ? 'transcribing' : 'idle')
  }

  return (
    <div className="yl-shell">
      <div className="yl-shell__grain" aria-hidden="true" />
      <div className="yl-shell__glow yl-shell__glow--left" aria-hidden="true" />
      <div className="yl-shell__glow yl-shell__glow--right" aria-hidden="true" />

      {stage === 'entry' && (
        <main className="entry-page">
          <section className="entry-stage">
            <div className="entry-stage__brand">
              <span className="brand-pill brand-pill--large">心</span>
              <div>
                <span className="yl-kicker">银龄心语 · Family Emotional OS</span>
                <h1>让关心，不再停留在“想一想”。</h1>
              </div>
            </div>
            <p className="entry-stage__summary">先确认你是谁，再把你放进家里。之后你会进入更适合自己的使用首页。</p>
            <div className="entry-actions entry-actions--center">
              <button className="yl-btn yl-btn--primary" type="button" onClick={() => { setAuthMode('register'); setStage('auth') }}>注册</button>
              <button className="yl-btn yl-btn--secondary" type="button" onClick={() => { setAuthMode('login'); setStage('auth') }}>登录</button>
            </div>
            <div className="entry-stage__footnotes">
              <span>适合长辈与家人共同使用</span>
              <span>语音优先 · 家庭协同 · 持续回访</span>
            </div>
          </section>
        </main>
      )}

      {stage === 'auth' && (
        <main className="auth-page">
          <OnboardingShell current={currentStep}>
          <section className="auth-card">
            <div className="auth-head">
              <div>
                <span className="yl-kicker">进入银龄心语</span>
                <h1>{authMode === 'login' ? '欢迎回来' : '先创建你的账户'}</h1>
                <p>先确认账号，再确认你在这个家庭里的身份。</p>
              </div>
              <div className="auth-tabs">
                <button className={authMode === 'login' ? 'is-active' : ''} type="button" onClick={() => setAuthMode('login')}>登录</button>
                <button className={authMode === 'register' ? 'is-active' : ''} type="button" onClick={() => setAuthMode('register')}>注册</button>
              </div>
            </div>
            <div className="form-grid">
              <label className="yl-field">
                <span>手机号 / 邮箱</span>
                <input type="text" placeholder="请输入手机号或邮箱" />
              </label>
              <label className="yl-field">
                <span>{authMode === 'login' ? '密码' : '验证码 / 密码'}</span>
                <input type="text" placeholder={authMode === 'login' ? '请输入密码' : '请输入验证码或设置密码'} />
              </label>
              <div className="form-actions">
                <button className="yl-btn yl-btn--primary" type="button" onClick={() => setStage('role')}>{authMode === 'login' ? '登录并继续' : '注册并继续'}</button>
                <button className="yl-btn yl-btn--ghost" type="button" onClick={() => setStage('entry')}>返回</button>
              </div>
            </div>
          </section>
          </OnboardingShell>
        </main>
      )}

      {stage === 'role' && (
        <main className="role-page">
          <OnboardingShell current={currentStep}>
          <section className="page-head">
            <span className="yl-kicker">身份确认</span>
            <h1>你在这个家庭里是？</h1>
            <p>先选身份，再绑定家庭。之后页面不会直接写“老人端 / 子女端”，而是自然进入更适合你的界面。</p>
          </section>
          <div className="role-grid">
            {roleCards.map((item) => (
              <button key={item.id} className={`role-card ${role === item.id ? 'is-active' : ''}`} type="button" onClick={() => setRole(item.id)}>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </button>
            ))}
          </div>
          <div className="page-actions">
            <button className="yl-btn yl-btn--primary" type="button" disabled={!role} onClick={() => setStage('family')}>继续绑定家庭</button>
            <button className="yl-btn yl-btn--ghost" type="button" onClick={() => setStage('auth')}>返回上一步</button>
          </div>
          </OnboardingShell>
        </main>
      )}

      {stage === 'family' && (
        <main className="bind-page">
          <OnboardingShell current={currentStep}>
          <section className="page-head page-head--split">
            <div>
              <span className="yl-kicker">家庭绑定</span>
              <h1>{roleLabel}身份已确认，接下来把你放进家里。</h1>
              <p>你可以创建一个新家庭、通过家庭 ID 加入，也可以先跳过绑定，以单人状态进入网页。</p>
            </div>
            <div className="identity-badge">{roleLabel}</div>
          </section>

          <div className="bind-grid">
            <section className="bind-card">
              <div className="mode-tabs">
                <button className={familyMode === 'create' ? 'is-active' : ''} type="button" onClick={createFamily}>创建家庭</button>
                <button className={familyMode === 'join' ? 'is-active' : ''} type="button" onClick={() => setFamilyMode('join')}>加入家庭</button>
                <button className={familyMode === 'skip' ? 'is-active' : ''} type="button" onClick={() => { setFamilyMode('skip'); setFamilyId(''); setFamilyName('未绑定家庭'); setMembers([]) }}>稍后绑定</button>
              </div>

              {familyMode === 'idle' && (
                <div className="bind-empty">
                  <h2>先选择一种方式继续</h2>
                  <p>如果你是第一次建立家庭，建议先创建；如果家人已经创建好了，可以直接输入家庭 ID 加入。</p>
                </div>
              )}

              {familyMode === 'create' && (
                <div className="bind-panel">
                  <h2>已为你准备一个新家庭</h2>
                  <p>这个 ID 可以稍后发给其他家人或长辈继续绑定。</p>
                  <div className="family-id-box">
                    <span>家庭 ID</span>
                    <strong>{familyId}</strong>
                  </div>
                </div>
              )}

              {familyMode === 'join' && (
                <div className="bind-panel">
                  <h2>通过家庭 ID 加入</h2>
                  <label className="yl-field">
                    <span>输入家庭 ID</span>
                    <input type="text" value={joinId} onChange={(event) => setJoinId(event.target.value)} placeholder={joinHints[0]} />
                  </label>
                  <div className="hint-chips">
                    {joinHints.map((item) => (
                      <button key={item} className="chip-button" type="button" onClick={() => setJoinId(item)}>{item}</button>
                    ))}
                  </div>
                  <button className="yl-btn yl-btn--secondary" type="button" onClick={joinFamily}>确认加入</button>
                </div>
              )}

              {familyMode === 'skip' && (
                <div className="bind-panel">
                  <h2>先以单人状态进入</h2>
                  <p>进入后家庭成员为空，但系统会一直保留“绑定家庭 / 添加成员”的入口。</p>
                </div>
              )}

              <div className="form-actions">
                <button className="yl-btn yl-btn--primary" type="button" disabled={!role || familyMode === 'idle'} onClick={enterApp}>进入网页 App</button>
                <button className="yl-btn yl-btn--ghost" type="button" onClick={() => setStage('role')}>返回身份选择</button>
              </div>
            </section>

            <aside className="family-board">
              <div className="family-board__head">
                <strong>{familyName}</strong>
                <span>{familyMode === 'skip' ? '暂未绑定家庭' : '家庭关系框架'}</span>
              </div>
              <div className="family-board__grid">
                <FamilySlot title="长辈" member={allMembers.find((item) => item.role === 'elder')} disabled={familyMode === 'skip'} onAdd={() => setInviteRole('elder')} />
                <FamilySlot title="家人" member={allMembers.find((item) => item.role === 'family')} disabled={familyMode === 'skip'} onAdd={() => setInviteRole('family')} />
                <FamilySlot title="照护协作者" member={allMembers.find((item) => item.role === 'caregiver')} disabled={familyMode === 'skip'} onAdd={() => setInviteRole('caregiver')} />
              </div>

              {inviteRole ? (
                <div className="invite-panel">
                  <strong>绑定{inviteRole === 'elder' ? '长辈' : inviteRole === 'family' ? '家人' : '照护协作者'}</strong>
                  <label className="yl-field">
                    <span>通过成员 ID 搜索</span>
                    <input type="text" value={inviteId} onChange={(event) => setInviteId(event.target.value)} placeholder="输入成员 ID" />
                  </label>
                  <div className="form-actions">
                    <button className="yl-btn yl-btn--secondary" type="button" onClick={addMember}>绑定到家庭</button>
                    <button className="yl-btn yl-btn--ghost" type="button" onClick={() => setInviteRole(null)}>取消</button>
                  </div>
                </div>
              ) : (
                <p className="family-board__hint">点击对应位置的 “+” 即可绑定家庭成员。第二阶段再接入真实搜索与邀请逻辑。</p>
              )}
            </aside>
          </div>
          </OnboardingShell>
        </main>
      )}

      {stage === 'app' && role === 'family' && (
        <AppShell title={familyPage === 'home' ? '' : familyNav.find((item) => item.id === familyPage)?.label ?? ''} familyName={familyName}>
          <nav className="side-nav">
            {familyNav.map((item) => (
              <button key={item.id} className={`side-nav__item ${familyPage === item.id ? 'is-active' : ''}`} type="button" onClick={() => setFamilyPage(item.id)}>{item.label}</button>
            ))}
          </nav>

          <section className="shell-body">
            {familyPage === 'home' ? (
              <>
                <header className="family-home-top">
                  <div className="family-home-top__status">
                    <span className="yl-kicker">首页总览</span>
                    <p>成员、计划、家庭聊天都在这一屏里。</p>
                  </div>
                  <div className="family-home-top__actions">
                    <button className="icon-chip" type="button" aria-label="通知">铃</button>
                    <button className="icon-chip" type="button" aria-label="设置">设</button>
                    <button className="family-switch" type="button">{familyName}</button>
                  </div>
                </header>

                <div className="home-grid home-grid--family">
                  <article className="surface-card surface-card--wide">
                    <div className="card-head">
                      <div>
                        <span className="card-kicker">家庭成员</span>
                        <h2>长辈信息与近况</h2>
                      </div>
                      <button className="text-link" type="button" onClick={() => setFamilyPage('members')}>进入成员页</button>
                    </div>
                    <div className="member-list">
                      {(allMembers.length ? allMembers : [makeMember('暂无家庭成员', 'family', '未绑定', '你可以稍后再绑定家庭成员', ['状态平稳'])]).map((member) => (
                        <article className="member-card" key={`${member.name}-${member.role}`}>
                          <div className={`member-card__avatar member-card__avatar--${member.role}`}>{member.name.slice(0, 1)}</div>
                          <div className="member-card__body">
                            <div className="member-card__title">
                              <strong>{member.name}</strong>
                              <span>{member.relation}</span>
                            </div>
                            <p>{member.note}</p>
                            <div className="member-card__tags">
                              {member.tags.map((tag) => <span key={tag}>{tag}</span>)}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </article>

                  <article className="surface-card">
                    <div className="card-head">
                      <div>
                        <span className="card-kicker">今日计划</span>
                        <h2>今天要做的几件事</h2>
                      </div>
                      <button className="text-link" type="button" onClick={() => setFamilyPage('plan')}>进入计划页</button>
                    </div>
                    <div className="plan-list">
                      {familyPlans.map((plan) => (
                        <article className="plan-item" key={plan.title}>
                          <span>{plan.time}</span>
                          <div>
                            <strong>{plan.title}</strong>
                            <p>{plan.note}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="plan-summary">
                      <strong>今日节奏建议</strong>
                      <p>先轻联系，再慢慢往下聊。</p>
                    </div>
                  </article>

                  <article className="surface-card">
                    <div className="card-head">
                      <div>
                        <span className="card-kicker">我的家庭</span>
                        <h2>和家人、AI 保持对话</h2>
                      </div>
                      <button className="text-link" type="button" onClick={() => setFamilyPage('family-chat')}>进入聊天页</button>
                    </div>
                    <div className="thread-list">
                      {familyThreads.map((thread) => (
                        <article className="thread-card" key={thread.title}>
                          <span>{thread.badge}</span>
                          <strong>{thread.title}</strong>
                          <p>{thread.summary}</p>
                        </article>
                      ))}
                    </div>
                    <div className="family-chat-footnote">
                      <span>聊天入口</span>
                      <p>这里会继续承接家庭对话与 AI 协同。</p>
                    </div>
                  </article>
                </div>
              </>
            ) : (
              <FeatureShell
                title={familyPage === 'members' ? '家庭成员' : familyPage === 'plan' ? '今日计划' : familyPage === 'family-chat' ? '我的家庭' : '设置'}
                summary={
                  familyPage === 'members'
                    ? '这里承接长辈信息、标签、状态与近况摘要。'
                    : familyPage === 'plan'
                      ? '这里承接更完整的今日计划、状态变化和回访安排。'
                      : familyPage === 'family-chat'
                        ? '这里承接家庭聊天与 AI 对话。'
                        : '这里承接通知、家庭切换、账号与界面设置。'
                }
                onBack={() => setFamilyPage('home')}
              >
                {familyPage === 'members' && (
                  <div className="placeholder-stack">
                    {allMembers.map((member) => (
                      <article className="placeholder-panel" key={`${member.name}-${member.role}`}>
                        <strong>{member.name} · {member.relation}</strong>
                        <p>{member.note}</p>
                      </article>
                    ))}
                  </div>
                )}
                {familyPage === 'plan' && (
                  <div className="placeholder-stack">
                    {familyPlans.map((plan) => (
                      <article className="placeholder-panel" key={plan.title}>
                        <strong>{plan.time} · {plan.title}</strong>
                        <p>{plan.note}</p>
                      </article>
                    ))}
                  </div>
                )}
                {familyPage === 'family-chat' && (
                  <div className="chat-shell">
                    <aside className="chat-shell__threads">
                      {familyThreads.map((thread) => (
                        <button className="chat-shell__thread" key={thread.title} type="button">
                          <strong>{thread.title}</strong>
                          <p>{thread.summary}</p>
                        </button>
                      ))}
                    </aside>
                    <div className="chat-shell__window">
                      {chatPreview.map((item) => (
                        <article className={`chat-bubble chat-bubble--${item.type}`} key={`${item.who}-${item.text}`}>
                          <span>{item.who}</span>
                          <p>{item.text}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
                {familyPage === 'settings' && (
                  <div className="placeholder-stack">
                    <article className="placeholder-panel">
                      <strong>设置</strong>
                      <p>这里会承接通知、家庭切换和账号设置。</p>
                    </article>
                  </div>
                )}
              </FeatureShell>
            )}
          </section>
        </AppShell>
      )}

      {stage === 'app' && role === 'elder' && (
        <AppShell title={elderPage === 'home' ? '' : elderNav.find((item) => item.id === elderPage)?.label ?? ''} familyName={familyName}>
          <nav className="side-nav">
            {elderNav.map((item) => (
              <button key={item.id} className={`side-nav__item ${elderPage === item.id ? 'is-active' : ''}`} type="button" onClick={() => setElderPage(item.id)}>{item.label}</button>
            ))}
          </nav>

          <section className="shell-body">
            {elderPage === 'home' ? (
              <div className="home-grid home-grid--elder">
                <section className="surface-card surface-card--hero">
                  <span className="card-kicker">首页</span>
                  <h1>张阿姨，下午好。</h1>
                  <p>今天想聊聊，还是我先问问你过得怎么样？</p>
                  <div className="elder-greeting__meta">
                    <span>今天的节奏：慢一点、轻一点</span>
                  </div>
                </section>

                <article className="surface-card surface-card--wide">
                  <div className="card-head">
                      <div>
                        <span className="card-kicker">和我说说话</span>
                        <h2>主入口承接聊天</h2>
                      </div>
                      <button className="text-link" type="button" onClick={() => setElderPage('chat')}>进入聊天页</button>
                    </div>
                  <div className="chat-entry">
                    <div className="chat-entry__preview">
                      {chatPreview.map((item) => (
                        <article className={`chat-bubble chat-bubble--${item.type}`} key={`${item.who}-${item.text}`}>
                          <span>{item.who}</span>
                          <p>{item.text}</p>
                        </article>
                      ))}
                    </div>
                    <button className={`voice-orb voice-orb--${voiceState}`} type="button" onClick={toggleVoice}>
                      <span className="voice-orb__ring" aria-hidden="true" />
                      <span className="voice-orb__core" aria-hidden="true">{voiceState === 'transcribing' ? '···' : '●'}</span>
                    </button>
                    <p className="chat-entry__helper">{voiceLabel}</p>
                    <div className="chat-entry__note">
                      <strong>回访会在聊天里自然发生</strong>
                      <p>AI 会在聊天里主动提起今天该回访的话题。</p>
                    </div>
                  </div>
                </article>

                <article className="surface-card">
                  <div className="card-head">
                      <div>
                        <span className="card-kicker">我的日记</span>
                        <h2>把今天想留下的话记下</h2>
                      </div>
                      <button className="text-link" type="button" onClick={() => setElderPage('diary')}>进入日记页</button>
                    </div>
                  <div className="diary-preview">
                    {diaryEntries.map((entry) => (
                      <article className="diary-preview__item" key={entry.title}>
                        <span>{entry.date}</span>
                        <strong>{entry.title}</strong>
                        <p>{entry.body}</p>
                      </article>
                    ))}
                  </div>
                </article>

                <article className="surface-card">
                  <div className="card-head">
                      <div>
                        <span className="card-kicker">需要帮忙</span>
                        <h2>需要时一眼知道该点哪里</h2>
                      </div>
                      <button className="text-link" type="button" onClick={() => setElderPage('help')}>进入帮助页</button>
                    </div>
                  <div className="help-actions">
                    <button className="yl-btn yl-btn--secondary" type="button">联系家人</button>
                    <button className="yl-btn yl-btn--secondary" type="button">联系社区</button>
                    <button className="yl-btn yl-btn--primary" type="button">我现在不舒服</button>
                  </div>
                </article>
              </div>
            ) : (
              <FeatureShell
                title={elderPage === 'chat' ? '和我说说话' : elderPage === 'diary' ? '我的日记' : elderPage === 'help' ? '需要帮忙' : '设置'}
                summary={
                  elderPage === 'chat'
                    ? '这里会像社交软件一样承接 AI 和家庭成员的聊天，AI 的主动回访也发生在这里。'
                    : elderPage === 'diary'
                      ? '这里承接长辈的日记、记录和轻回顾。'
                      : elderPage === 'help'
                        ? '这里承接家人、社区和身体不适等帮助路径。'
                        : '这里承接字体、声音、联系人与界面设置。'
                }
                onBack={() => setElderPage('home')}
              >
                {elderPage === 'chat' && (
                  <div className="chat-shell chat-shell--elder">
                    <aside className="chat-shell__threads">
                      <button className="chat-shell__thread" type="button">
                        <strong>心语</strong>
                        <p>今天的主动回访会在这里发起。</p>
                      </button>
                      <button className="chat-shell__thread" type="button">
                        <strong>我的家庭</strong>
                        <p>这里会承接与家人的聊天与留言。</p>
                      </button>
                    </aside>
                    <div className="chat-shell__window">
                      {chatPreview.map((item) => (
                        <article className={`chat-bubble chat-bubble--${item.type}`} key={`${item.who}-${item.text}`}>
                          <span>{item.who}</span>
                          <p>{item.text}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
                {elderPage === 'diary' && (
                  <div className="placeholder-stack">
                    {diaryEntries.map((entry) => (
                      <article className="placeholder-panel" key={entry.title}>
                        <strong>{entry.date} · {entry.title}</strong>
                        <p>{entry.body}</p>
                      </article>
                    ))}
                  </div>
                )}
                {elderPage === 'help' && (
                  <div className="help-actions">
                    <button className="yl-btn yl-btn--secondary" type="button">联系女儿</button>
                    <button className="yl-btn yl-btn--secondary" type="button">联系社区</button>
                    <button className="yl-btn yl-btn--primary" type="button">我现在身体不舒服</button>
                  </div>
                )}
                {elderPage === 'settings' && (
                  <div className="placeholder-stack">
                    <article className="placeholder-panel">
                      <strong>设置</strong>
                      <p>这里会承接字体大小、语音速度、声音开关和联系人设置。</p>
                    </article>
                  </div>
                )}
              </FeatureShell>
            )}
          </section>
        </AppShell>
      )}

      {stage === 'app' && role === 'caregiver' && (
        <AppShell title="" familyName={familyName}>
          <section className="caregiver-placeholder">
            <span className="yl-kicker">照护协作者端</span>
            <h1>这个端侧先保留为独立入口。</h1>
            <p>当前阶段只确认信息架构中存在独立端侧，不混入家人侧模块。首页样式和功能将在第二阶段展开。</p>
          </section>
        </AppShell>
      )}
    </div>
  )
}

type AppShellProps = {
  title: string
  familyName: string
  children: React.ReactNode
}

function AppShell({ title, familyName, children }: AppShellProps) {
  return (
    <main className="workspace-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="brand-pill">心</span>
          <div>
            <strong>银龄心语</strong>
            <span>{familyName}</span>
          </div>
        </div>
        <div className="app-header__center">{title ? <span className="app-header__title">{title}</span> : null}</div>
        <div className="app-header__actions">
          <button className="icon-chip" type="button" aria-label="通知">铃</button>
          <button className="icon-chip" type="button" aria-label="设置">设</button>
        </div>
      </header>
      {children}
    </main>
  )
}

type FeatureShellProps = {
  title: string
  summary: string
  onBack: () => void
  children: React.ReactNode
}

function FeatureShell({ title, summary, onBack, children }: FeatureShellProps) {
  return (
    <section className="feature-shell">
      <div className="feature-shell__header">
        <button className="yl-btn yl-btn--ghost" type="button" onClick={onBack}>返回首页</button>
        <div>
          <span className="yl-kicker">功能页框架</span>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
      </div>
      <div className="feature-shell__body">{children}</div>
    </section>
  )
}

type FamilySlotProps = {
  title: string
  member?: Member
  disabled: boolean
  onAdd: () => void
}

function FamilySlot({ title, member, disabled, onAdd }: FamilySlotProps) {
  return (
    <article className={`family-slot ${disabled ? 'is-disabled' : ''}`}>
      <span className="family-slot__title">{title}</span>
      {member ? (
        <div className={`family-slot__member family-slot__member--${member.role}`}>
          <strong>{member.name}</strong>
          <p>{member.relation}</p>
        </div>
      ) : (
        <button className="family-slot__add" type="button" disabled={disabled} onClick={onAdd}>+</button>
      )}
    </article>
  )
}

type OnboardingShellProps = {
  current: OnboardingStep | null
  children: React.ReactNode
}

function OnboardingShell({ current, children }: OnboardingShellProps) {
  const steps: Array<{ id: OnboardingStep; label: string; note: string }> = [
    { id: 'auth', label: '进入账户', note: '先确认账号' },
    { id: 'role', label: '确认身份', note: '决定自己是谁' },
    { id: 'family', label: '绑定家庭', note: '再把自己放进家里' },
  ]

  return (
    <div className="onboarding-shell">
      <div className="onboarding-shell__header">
        <div className="onboarding-shell__brand">
          <span className="brand-pill">心</span>
          <div>
            <strong>银龄心语</strong>
            <span>网页 App 初版流程</span>
          </div>
        </div>
        <div className="onboarding-steps">
          {steps.map((step, index) => {
            const activeIndex = current ? steps.findIndex((item) => item.id === current) : -1
            const isDone = activeIndex > index
            const isActive = current === step.id
            return (
              <div className={`onboarding-step ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`} key={step.id}>
                <span className="onboarding-step__index">{index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.note}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {children}
    </div>
  )
}

export default App
