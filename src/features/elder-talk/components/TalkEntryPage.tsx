import { FeatureEntryScaffold } from '../../../components/common/FeatureEntryScaffold'
import { talkPreview } from '../data/talkData'

type TalkEntryPageProps = {
  onBack: () => void
}

export function TalkEntryPage({ onBack }: TalkEntryPageProps) {
  return (
    <FeatureEntryScaffold
      eyebrow="说一说"
      title="长辈端 · 说一说"
      summary="这里先保留 AI 聊天的模块接口，后续语音输入、转写、聊天流都在这个目录继续开发。"
      owner="长辈端对话负责人"
      path="src/features/elder-talk"
      notes={[
        '首页只负责把入口放出来，真正的聊天页后续在这里展开。',
        '语音输入、转写和对话历史都建议继续收口在本模块内。',
      ]}
      onBack={onBack}
    >
      {talkPreview.map((item) => (
        <article className="bubble-row" key={`${item.speaker}-${item.text}`}>
          <span>{item.speaker}</span>
          <p>{item.text}</p>
        </article>
      ))}
    </FeatureEntryScaffold>
  )
}
