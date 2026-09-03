import type { ReactNode } from 'react'
import type { ElderPage, FamilyPage, VoiceState } from './appData'
import { quickActions } from './appData'

type FeatureShellProps = {
  title: string
  badge: string
  summary: string
  note: string
  onBack: () => void
  children: ReactNode
}

export function FeaturePageShell({
  title,
  badge,
  summary,
  note,
  onBack,
  children,
}: FeatureShellProps) {
  return (
    <section className="feature-shell">
      <div className="feature-shell__header">
        <button className="back-button" type="button" onClick={onBack}>
          返回首页
        </button>

        <div className="feature-shell__intro">
          <span className="soft-pill soft-pill--warm">{badge}</span>
          <h1>{title}</h1>
          <p>{summary}</p>
          <p className="feature-shell__note">{note}</p>
        </div>
      </div>

      <div className="feature-shell__body">{children}</div>
    </section>
  )
}

export function renderFamilyFeatureContent(
  page: Exclude<FamilyPage, 'home'>,
  openScriptDrawer: (next: boolean) => void,
) {
  if (page === 'care') {
    return (
      <div className="feature-grid">
        <article className="feature-card feature-card--wide card">
          <p className="eyebrow">今日关怀</p>
          <h2>今天最值得做的动作和下一步节奏</h2>
          <div className="feature-checklist">
            <div>
              <span>最佳联系窗口</span>
              <strong>今晚 20:00 - 21:00</strong>
            </div>
            <div>
              <span>建议方式</span>
              <strong>先发语音，再轻追问</strong>
            </div>
            <div>
              <span>下一步接力</span>
              <strong>明晚 19:40 轻回访</strong>
            </div>
          </div>
        </article>

        <article className="feature-card card">
          <p className="eyebrow">延展能力</p>
          <h3>这一页后续可以接什么</h3>
          <ul className="marketing-list">
            <li>完整时间线筛选</li>
            <li>任务优先级算法</li>
            <li>关怀效果量化</li>
            <li>回访自动建议</li>
          </ul>
        </article>
      </div>
    )
  }

  if (page === 'contact') {
    return (
      <div className="feature-grid">
        <article className="feature-card feature-card--wide card">
          <p className="eyebrow">即时联系</p>
          <h2>把所有高频动作收在一个工作区里</h2>
          <div className="action-grid action-grid--large">
            {quickActions.map((action) => (
              <button key={action} className="action-grid__button" type="button">
                <span className="action-grid__icon" aria-hidden="true" />
                {action}
              </button>
            ))}
          </div>
        </article>

        <article className="feature-card card">
          <p className="eyebrow">说明</p>
          <h3>后端不实现也要先有这个壳子</h3>
          <p>因为它是家人端最高频的真实动作，后续接短信、微信、视频预约时，页面结构不能重新推翻。</p>
        </article>
      </div>
    )
  }

  if (page === 'script') {
    return (
      <div className="feature-grid">
        <article className="feature-card feature-card--wide card">
          <p className="eyebrow">关系脚本</p>
          <h2>不会开口的时候，这里直接给你可说的话</h2>
          <div className="script-preview">
            <div>
              <span>开场</span>
              <p>妈，我刚刚突然想到你，昨天那句话我一直记着。</p>
            </div>
            <div>
              <span>共情</span>
              <p>你不想让我担心我知道，但你说出来我会更踏实。</p>
            </div>
            <div>
              <span>收尾</span>
              <p>我明晚再来问你，不让你一个人扛着。</p>
            </div>
          </div>
        </article>

        <article className="feature-card card">
          <p className="eyebrow">动作</p>
          <h3>脚本不是文档，是工具</h3>
          <button className="button button--secondary" type="button" onClick={() => openScriptDrawer(true)}>
            打开脚本抽屉
          </button>
        </article>
      </div>
    )
  }

  if (page === 'collab') {
    return (
      <div className="feature-grid">
        <article className="feature-card feature-card--wide card">
          <p className="eyebrow">家庭协作</p>
          <h2>谁联系、谁兜底、谁接力，都先在结构里站稳</h2>
          <div className="coordination-list">
            <div>
              <span>今晚语音问候</span>
              <strong>女儿 · 主负责</strong>
            </div>
            <div>
              <span>周末视频通话</span>
              <strong>儿子 · 协作</strong>
            </div>
            <div>
              <span>高风险升级</span>
              <strong>女儿 &gt; 儿子 &gt; 社区</strong>
            </div>
          </div>
        </article>

        <article className="feature-card card">
          <p className="eyebrow">后续能力</p>
          <h3>这一页适合接</h3>
          <ul className="marketing-list">
            <li>任务分派</li>
            <li>轮值排班</li>
            <li>协作备注</li>
            <li>无人响应升级</li>
          </ul>
        </article>
      </div>
    )
  }

  return (
    <div className="feature-grid">
      <article className="feature-card feature-card--wide card">
        <p className="eyebrow">授权隐私</p>
        <h2>先把信任框架立住，再接真实权限规则</h2>
        <div className="privacy-grid">
          <div>
            <span>日常情绪摘要</span>
            <strong>可见</strong>
          </div>
          <div>
            <span>原话转写</span>
            <strong>默认关闭</strong>
          </div>
          <div>
            <span>记忆长期保留</span>
            <strong>仅确认后</strong>
          </div>
          <div>
            <span>高风险通知</span>
            <strong>按家属顺序升级</strong>
          </div>
        </div>
      </article>

      <article className="feature-card card">
        <p className="eyebrow">目标</p>
        <h3>让家属明白什么能看、为什么能看</h3>
        <p>这页先把开关和说明位置搭出来，后面后端接权限规则时就不会重新拆首页结构。</p>
      </article>
    </div>
  )
}

export function renderElderFeatureContent(
  page: Exclude<ElderPage, 'home'>,
  voiceState: VoiceState,
  voiceHelper: string,
  onVoiceAction: () => void,
) {
  if (page === 'talk') {
    return (
      <div className="feature-grid">
        <article className="feature-card feature-card--wide card feature-card--elder-talk">
          <p className="eyebrow">陪伴对话</p>
          <h2>这里是长辈真正开始说话的地方</h2>
          <div className="conversation-preview">
            <div className="bubble bubble--system">我在，今天想先聊聊什么？</div>
            <div className="bubble bubble--user">昨晚还是没太睡好。</div>
            <div className="bubble bubble--system">听起来你昨晚挺难受的，我们先慢慢说。</div>
          </div>
          <button className={`elder-talk__mic elder-talk__mic--${voiceState}`} type="button" onClick={onVoiceAction}>
            <span className="elder-talk__mic-ring" aria-hidden="true" />
            <span className="elder-talk__mic-core" aria-hidden="true">
              {voiceState === 'transcribing' ? '···' : '●'}
            </span>
          </button>
          <p className="elder-talk__helper">{voiceHelper}</p>
        </article>
      </div>
    )
  }

  if (page === 'memory') {
    return (
      <div className="feature-grid">
        <article className="feature-card feature-card--wide card">
          <p className="eyebrow">回忆一下</p>
          <h2>把最近提过的人和事，温柔地放在这里</h2>
          <div className="memory-list">
            <div>
              <span>最近提到的人</span>
              <strong>女儿、老同事、邻居王阿姨</strong>
            </div>
            <div>
              <span>最近挂心的事</span>
              <strong>睡眠、腿酸、想吃橙子</strong>
            </div>
            <div>
              <span>想继续说的话题</span>
              <strong>下周家里吃什么、旧照片、春天去哪里散步</strong>
            </div>
          </div>
        </article>
      </div>
    )
  }

  if (page === 'greeting') {
    return (
      <div className="feature-grid">
        <article className="feature-card feature-card--wide card">
          <p className="eyebrow">家人问候</p>
          <h2>不是消息列表，而是单独递来的问候</h2>
          <div className="greeting-list">
            <article className="greeting-tile">
              <strong>女儿 · 今天 18:10</strong>
              <p>“妈，我今天下班有点晚，但一直记着你昨天说没睡好。”</p>
            </article>
            <article className="greeting-tile">
              <strong>儿子 · 昨天 20:30</strong>
              <p>“这周末我给你打视频，咱们一起看看上次那张老照片。”</p>
            </article>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="feature-grid">
      <article className="feature-card feature-card--wide card">
        <p className="eyebrow">需要帮忙</p>
        <h2>需要的时候，一眼知道该点哪里</h2>
        <div className="help-grid">
          <button className="button button--secondary" type="button">
            联系女儿
          </button>
          <button className="button button--secondary" type="button">
            联系社区
          </button>
          <button className="button button--primary" type="button">
            我现在身体不舒服
          </button>
        </div>
      </article>
    </div>
  )
}
