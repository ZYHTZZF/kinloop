import { HomeModuleCard } from '../../../components/common/HomeModuleCard'
import { talkPreview } from '../data/talkData'

export function TalkModule() {
  return (
    <HomeModuleCard
      title="说一说"
      subtitle="主入口"
      owner="长辈端对话负责人"
      path="src/features/elder-talk"
      actionLabel="进入 AI 聊天"
    >
      <div className="stack-list">
        {talkPreview.map((item) => (
          <article className="bubble-row" key={`${item.speaker}-${item.text}`}>
            <span>{item.speaker}</span>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
      <div className="module-note">
        <strong>后续接入</strong>
        <p>语音输入、转写、AI 对话流和聊天页都只在这个模块内继续展开。</p>
      </div>
    </HomeModuleCard>
  )
}
