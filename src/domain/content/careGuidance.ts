export type CareAction = {
  label: string
  note: string
}

export const careActions: CareAction[] = [
  { label: '怎么开口', note: '先从昨晚睡得怎么样开始，不要一上来追问。' },
  { label: '立即行动', note: '推荐先发一段 30 秒语音，再决定是否打电话。' },
]
