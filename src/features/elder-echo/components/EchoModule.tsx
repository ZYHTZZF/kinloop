import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { familyEchoCardsSeed, memoryEchoCardsSeed } from '../data/echoData'

type EchoModuleProps = {
  onOpen: () => void
}

export function EchoModule({ onOpen }: EchoModuleProps) {
  return (
    <HomeModuleCard
      title="回音"
      subtitle="被回应、被记住"
      owner="长辈端回音负责人"
      path="src/features/elder-echo"
      actionLabel="查看回音"
      onAction={onOpen}
    >
      <div className="stack-list">
        <article className="list-panel">
          <span>家人回应</span>
          <strong>{familyEchoCardsSeed[0].title}</strong>
          <p>{familyEchoCardsSeed[0].summary}</p>
        </article>
        <article className="list-panel">
          <span>我的回忆 / 关心记录</span>
          <strong>{memoryEchoCardsSeed[0].topic}</strong>
          <p>{memoryEchoCardsSeed[0].promptText}</p>
        </article>
      </div>
    </HomeModuleCard>
  )
}
