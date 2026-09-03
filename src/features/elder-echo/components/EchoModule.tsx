import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { echoItems } from '../data/echoData'

export function EchoModule() {
  return (
    <HomeModuleCard
      title="回音"
      subtitle="被回应、被记住"
      owner="长辈端回音负责人"
      path="src/features/elder-echo"
      actionLabel="查看回应"
    >
      <div className="stack-list">
        {echoItems.map((item) => (
          <article className="list-panel" key={item.title}>
            <span>{item.source}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </HomeModuleCard>
  )
}
