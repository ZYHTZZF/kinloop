import { TalkModule } from '../../features/elder-talk/components/TalkModule'
import { EchoModule } from '../../features/elder-echo/components/EchoModule'
import { HelpModule } from '../../features/elder-help/components/HelpModule'

export function ElderHomePage() {
  return (
    <section className="page-shell">
      <header className="page-shell__intro">
        <p className="page-shell__eyebrow">长辈端首页</p>
        <h2>表达先发生，再被接住，再升级成帮助。</h2>
        <p>
          这一页只负责摆放三个核心入口。后续不同同学分别维护“说一说”“回音”“找人帮忙”，互相尽量不改彼此文件。
        </p>
      </header>

      <div className="module-grid module-grid--elder">
        <TalkModule />
        <EchoModule />
        <HelpModule />
      </div>
    </section>
  )
}
