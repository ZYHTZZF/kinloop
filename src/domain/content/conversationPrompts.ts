export type TalkPrompt = {
  speaker: 'AI' | '我'
  text: string
}

export type EchoItem = {
  source: string
  title: string
  detail: string
}

export const talkPreview: TalkPrompt[] = [
  { speaker: 'AI', text: '今天想先聊哪件事？我会慢一点听。' },
  { speaker: '我', text: '昨晚睡得不太好。' },
]

export const echoItems: EchoItem[] = [
  {
    source: '家人回应',
    title: '你昨天说睡得浅，我记着了',
    detail: '今晚我下班后给你发一段放松语音，一起试试。',
  },
  {
    source: '我的回忆',
    title: '年轻时的工作伙伴',
    detail: '你上次提到老同事小周，想起了什么开心片段？',
  },
]
