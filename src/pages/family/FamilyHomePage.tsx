import { CareTodayModule } from '../../features/family-care/components/CareTodayModule'
import { ContinueCareModule } from '../../features/family-followup/components/ContinueCareModule'
import { RecentStatusModule } from '../../features/family-status/components/RecentStatusModule'

type FamilyHomePageProps = {
  onOpenCare: () => void
  onOpenStatus: () => void
  onOpenFollowup: () => void
}

export function FamilyHomePage({
  onOpenCare,
  onOpenStatus,
  onOpenFollowup,
}: FamilyHomePageProps) {
  return (
    <section className="page-shell">
      <header className="page-shell__intro">
        <p className="page-shell__eyebrow">子女端首页</p>
        <h2>先知道为什么联系，再知道怎么联系，最后把结果沉淀下来。</h2>
        <p>
          首页本身不承载复杂业务逻辑。每个模块单独成目录，适合不同人并行开发和单独提测。
        </p>
      </header>

      <div className="module-grid module-grid--family">
        <CareTodayModule onOpen={onOpenCare} />
        <RecentStatusModule onOpen={onOpenStatus} />
        <ContinueCareModule onOpen={onOpenFollowup} />
      </div>
    </section>
  )
}
