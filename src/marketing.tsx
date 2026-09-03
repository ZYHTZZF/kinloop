import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './marketing.css'

const valueStrip = [
  '为独居老人、空巢家庭与异地子女而设计',
  '关注情感连接，而不止安全提醒',
  '让表达、理解、接力与回访形成持续闭环',
  '不替代亲情，只降低关心发生的门槛',
] as const

const problemColumns = [
  {
    title: '想说的话，常常收了回去',
    body:
      '很多长辈不是没有人可以联系，而是没有一个能稳定接住表达的出口。白天的小事、晚上的失眠、反复提起的挂念，最后常常都变成一句“不想麻烦孩子”。',
  },
  {
    title: '想关心，却总卡在第一步',
    body:
      '很多家人不是不在意，而是不知道怎么开始，也很难坚持。担心打扰，怕说得生硬，察觉到父母状态不太对，却不知道今天到底该说什么、做什么更合适。',
  },
  {
    title: '安全被看见了，情感还没有',
    body:
      '很多养老产品已经把提醒、监测和报警做得很完整，但情感支持本身仍然是零散的。有联系，不等于有交流；有牵挂，也不等于知道怎么行动。',
  },
] as const

const differenceRows = [
  {
    lead: '不是普通陪聊',
    body: '而是把长辈的表达，变成家人可以真正接住的情绪与话题线索。',
  },
  {
    lead: '不是单点提醒',
    body: '而是把联系建议、沟通脚本和后续回访，组织成一条持续关怀路径。',
  },
  {
    lead: '不是只给答案',
    body: '而是帮助家人在合适的时候，用更合适的方式，做出更自然的回应。',
  },
] as const

const capabilities: ReadonlyArray<{
  title: string
  body: string
  featured?: boolean
}> = [
  {
    title: '情感陪伴',
    body: '让开口更容易。长辈可以从一句近况、一段语音、一个轻话题开始，被接住，而不是被盘问。',
  },
  {
    title: '家庭协同',
    body: '把零散表达整理成家人真正能理解的情绪与话题线索，帮助他们判断现在最值得回应什么。',
  },
  {
    title: '子女任务卡',
    body: '把“该联系一下了”，变成“今晚 20:10 这样开口更合适”。让关心从模糊意愿，落到可执行动作。',
    featured: true,
  },
  {
    title: '关系修复脚本',
    body: '当关系有点生、话题有点难时，给出不冒犯、不生硬、更有分寸的开场方式。',
  },
  {
    title: '长期记忆与回访',
    body: '记住那些容易被忽略的小事，让一次联系可以自然延续到下一次，而不是聊完就散。',
  },
  {
    title: '风险升级与隐私控制',
    body: '该安静时守边界，该升级时不迟疑。既不给家庭添压，也不把风险留给 AI 单独承担。',
  },
] as const

const sides = [
  {
    role: '长辈端',
    title: '长辈端负责表达与被陪伴',
    points: [
      '用更自然的语音与轻量互动降低表达门槛。',
      '接住情绪、记住日常，保留熟悉感。',
      '在需要时给出陪伴、提醒与回访。',
      '不是让长辈适应系统，而是让系统适应长辈。',
    ],
  },
  {
    role: '家人端',
    title: '家人端负责接力与持续关怀',
    points: [
      '接收任务卡、情绪线索与联系建议。',
      '获得更适合当下的开口方式。',
      '联系完成后回填结果，形成后续追踪。',
      '不是增加负担，而是减少“不知道怎么做”的消耗。',
    ],
  },
] as const

const journey = [
  {
    step: '01',
    title: '长辈表达',
    body: '“昨晚没怎么睡。”“最近总想起以前的事。”“你们忙，我不想打扰。”',
  },
  {
    step: '02',
    title: '系统理解',
    body: '识别情绪变化、反复提及的话题、表达频率与潜在风险等级。',
  },
  {
    step: '03',
    title: '家属接力',
    body: '生成建议动作、联系提醒、沟通脚本和优先级判断，帮助家人更快迈出第一步。',
  },
  {
    step: '04',
    title: '回访持续',
    body: '联系完成后记录结果，安排后续跟进，让一次关心自然过渡到下一次关心。',
  },
] as const

const scenes = [
  {
    title: '老人晚上失眠时',
    body:
      '长辈不一定会主动打电话，但更可能先说一句“昨晚又没怎么睡”。系统先接住当下，再把第二天更合适的关心方式交给家人。',
  },
  {
    title: '家属不知道怎么开口时',
    body:
      '系统不只提醒“去联系”，而是把第一句话、切入顺序和表达分寸一起准备好。',
  },
  {
    title: '家庭关系有点僵时',
    body:
      '很多关系不是没有感情，而是太久没联系，反而更难开口。系统提供更低压力的连接方式，帮第一步变得没那么重。',
  },
  {
    title: '出现高风险情绪时',
    body:
      '当表达里持续出现明显风险线索时，系统不会继续假装一切如常，而会触发升级机制，推动家属或人工支持及时介入。',
  },
] as const

const trustItems = [
  {
    title: '隐私可解释',
    body: '记录什么、为什么记录、谁可以看到，都应该说得清楚。',
  },
  {
    title: '分享有边界',
    body: '不是所有表达都会被同步；共享只发生在明确授权、必要提醒与风险触发场景。',
  },
  {
    title: '风险不靠 AI 单独承担',
    body: 'AI 负责识别与提示，高风险场景必须进入人工或家庭接力。',
  },
  {
    title: '适老化不是“大字模式”',
    body: '真正的适老化，是更低的表达门槛、更少的操作负担和更稳定的反馈节奏。',
  },
] as const

function MarketingPage() {
  return (
    <div className="mk-page">
      <div className="mk-page__texture" aria-hidden="true" />

      <header className="mk-header">
        <div className="mk-brand">
          <span className="mk-brand__mark">心</span>
          <div>
            <p className="mk-brand__name">银龄心语</p>
            <p className="mk-brand__meta">面向银发家庭的情感协同系统</p>
          </div>
        </div>

        <nav className="mk-nav" aria-label="官网导航">
          <a href="#problem">产品问题</a>
          <a href="#capability">核心能力</a>
          <a href="#journey">如何运作</a>
          <a href="#trust">信任边界</a>
        </nav>

        <div className="mk-header__actions">
          <a className="mk-btn mk-btn--ghost" href="#capability">
            核心能力
          </a>
          <a className="mk-btn mk-btn--solid" href="#journey">
            了解如何运作
          </a>
        </div>
      </header>

      <main className="mk-main">
        <section className="mk-hero">
          <div className="mk-hero__copy">
            <p className="mk-eyebrow">银龄心语 · Family Emotional OS</p>
            <h1>让那些本来容易中断的关心，重新在家庭里持续发生。</h1>
            <p className="mk-hero__summary">
              银龄心语是一套面向银发家庭的情感协同系统。
              它帮助长辈把想说的话说出来，也帮助家人把想关心的心意，落成今天就能执行的联系、回应与回访。
              它不替代亲情，只让亲情更容易被接住、被记住、被延续。
            </p>

            <div className="mk-hero__actions">
              <a className="mk-btn mk-btn--solid" href="#capability">
                查看核心能力
              </a>
              <a className="mk-btn mk-btn--ghost" href="#journey">
                查看产品闭环
              </a>
            </div>

            <p className="mk-hero__signature">陪伴不是一次说很多，而是一次次没有断掉。</p>
          </div>

          <div className="mk-hero__visual">
            <article className="mk-story-card mk-story-card--speech">
              <span className="mk-story-card__label">长辈表达</span>
              <p>“昨晚又没怎么睡好。”</p>
            </article>
            <article className="mk-story-card mk-story-card--task">
              <span className="mk-story-card__label">建议动作</span>
              <h2>今晚 20:10 发一段短语音</h2>
              <p>先别急着问身体，先从“昨晚睡得怎么样”开始。</p>
            </article>
            <article className="mk-story-card mk-story-card--timeline">
              <span className="mk-story-card__label">后续回访</span>
              <ul>
                <li>今晚完成联系</li>
                <li>明晚轻回访</li>
                <li>下周延续睡眠话题</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="mk-value-strip" aria-label="产品价值">
          {valueStrip.map((item) => (
            <article className="mk-value-strip__item" key={item}>
              <span className="mk-value-strip__dot" aria-hidden="true" />
              <p>{item}</p>
            </article>
          ))}
        </section>

        <section className="mk-section" id="problem">
          <div className="mk-section__intro">
            <p className="mk-eyebrow">产品问题</p>
            <h2>很多家庭真正缺的，不是联系工具，而是让关心能够持续发生的方法。</h2>
          </div>

          <div className="mk-problem-grid">
            {problemColumns.map((item) => (
              <article className="mk-problem-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mk-section mk-section--contrast">
          <div className="mk-section__intro">
            <p className="mk-eyebrow">产品差异</p>
            <h2>它不是把对话做得更像 AI，而是把关系做得更像关系。</h2>
          </div>

          <div className="mk-difference-list">
            {differenceRows.map((item) => (
              <article className="mk-difference-item" key={item.lead}>
                <strong>{item.lead}</strong>
                <p>{item.body}</p>
              </article>
            ))}
          </div>

          <aside className="mk-editorial-quote">
            <span className="mk-editorial-quote__mark">“</span>
            <p>我们设计的不是一段对话界面，而是一套让关心接得上、接得住、接得久的家庭机制。</p>
          </aside>
        </section>

        <section className="mk-section" id="capability">
          <div className="mk-section__intro">
            <p className="mk-eyebrow">核心能力</p>
            <h2>每一项能力，都对应一个现实里经常被卡住的瞬间。</h2>
          </div>

          <div className="mk-capability-grid">
            {capabilities.map((item) => (
              <article
                className={`mk-capability-card ${item.featured ? 'is-featured' : ''}`}
                key={item.title}
              >
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mk-section mk-section--soft">
          <div className="mk-section__intro">
            <p className="mk-eyebrow">双端说明</p>
            <h2>长辈负责表达，家人负责接力，系统负责把中间最容易断掉的那段路接起来。</h2>
          </div>

          <div className="mk-side-grid">
            {sides.map((item) => (
              <article className="mk-side-card" key={item.role}>
                <span className="mk-side-card__role">{item.role}</span>
                <h3>{item.title}</h3>
                <ul>
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <p className="mk-bridge-copy">一端让情绪有出口，一端让回应有抓手，闭环才真正成立。</p>
        </section>

        <section className="mk-section" id="journey">
          <div className="mk-section__intro">
            <p className="mk-eyebrow">如何运作</p>
            <h2>从一句近况开始，到一次真正发生的回应结束。</h2>
          </div>

          <div className="mk-journey-grid">
            {journey.map((item) => (
              <article className="mk-journey-card" key={item.step}>
                <span className="mk-journey-card__step">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mk-section mk-section--soft">
          <div className="mk-section__intro">
            <p className="mk-eyebrow">真实场景</p>
            <h2>它服务的不是抽象用户，而是这些一再发生的家庭时刻。</h2>
          </div>

          <div className="mk-scene-grid">
            {scenes.map((item) => (
              <article className="mk-scene-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mk-section" id="demo">
          <div className="mk-section__intro">
            <p className="mk-eyebrow">产品构成</p>
            <h2>官网建立认知，真实使用在双端里发生。</h2>
          </div>

          <div className="mk-structure-grid">
            <article className="mk-structure-card">
              <span>官网页</span>
              <h3>对外讲清价值与方法</h3>
              <p>用一页官网讲清楚它解决什么问题、如何运作，以及为什么值得信任。</p>
            </article>
            <article className="mk-structure-card">
              <span>家人端首页</span>
              <h3>把关心落成行动</h3>
              <p>承接任务卡、联系建议、沟通脚本和后续回访，让家人的关心更容易执行。</p>
            </article>
            <article className="mk-structure-card">
              <span>长辈端首页</span>
              <h3>把陪伴留在日常里</h3>
              <p>承接说话、回应、回忆与问候，让长辈每天打开时都感到熟悉、简单、安心。</p>
            </article>
          </div>

          <div className="mk-demo-cta">
            <a className="mk-btn mk-btn--solid" href="#trust">
              查看信任边界
            </a>
            <p>官网负责讲清产品，双端负责把这些能力真正接到家庭日常里。</p>
          </div>
        </section>

        <section className="mk-section mk-section--soft" id="trust">
          <div className="mk-section__intro">
            <p className="mk-eyebrow">信任边界</p>
            <h2>温度要成立，边界也要先成立。</h2>
          </div>

          <div className="mk-trust-grid">
            {trustItems.map((item) => (
              <article className="mk-trust-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mk-closing">
          <div className="mk-closing__copy">
            <p className="mk-eyebrow">一句话总结</p>
            <h2>银龄心语不替代亲情。它让亲情更容易持续发生。</h2>
            <p>
              从长辈表达，到家属接力，再到长期回访，银龄心语把那些原本容易错过、难以开口、也难以持续的关心，组织成可以发生、可以执行、可以延续的家庭行动。
            </p>
          </div>

          <div className="mk-closing__actions">
            <a className="mk-btn mk-btn--solid" href="#problem">
              重新查看产品问题
            </a>
            <p className="mk-closing__note">这不是一次性的对话体验，而是一套让关系被持续照顾的产品方法。</p>
          </div>
        </section>

        <footer className="mk-footer">
          <div>
            <strong>银龄心语</strong>
            <span>面向银发家庭的情感协同系统</span>
          </div>
          <div>
            <span>核心模块</span>
            <span>情感陪伴 · 任务卡 · 关系脚本 · 记忆回访</span>
          </div>
          <div>
            <span>产品入口</span>
            <a href="#journey">查看如何运作</a>
          </div>
        </footer>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MarketingPage />
  </StrictMode>,
)
