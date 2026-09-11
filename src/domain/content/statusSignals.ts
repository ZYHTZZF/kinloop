export type StatusItem = {
  time: string
  title: string
  detail: string
}

export const statusItems: StatusItem[] = [
  {
    time: '今天 08:40',
    title: '今天值得先联系一次：连续两天凌晨醒来后情绪走低。',
    detail: '先说“我记得你昨晚没睡稳，我在这儿”，比直接追问身体更容易接住她。',
  },
  {
    time: '昨天 19:10',
    title: '她在试探“会不会被持续关心”，建议先发语音再跟进。',
    detail: '“你们忙就别管我了”更像是在试探是否会被继续关心，而不是单纯拒绝沟通。',
  },
]
