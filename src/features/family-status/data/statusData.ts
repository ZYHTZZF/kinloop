import type { DecisionSessionVM, RecentStatusCardVM, StatusItem } from '../types'

export const decisionSessionsSeed: DecisionSessionVM[] = [
  {
    id: 'decision-1',
    tier: 'priority',
    processState: 'todo',
    time: '今天 08:40',
    insightTag: '情绪 + 睡眠',
    insightText: '今天值得先联系一次：连续两天凌晨醒来后情绪走低。',
    actionType: 'call',
    contactName: '妈妈',
    actionLabel: '先打电话稳住情绪',
    actionDoneText: '已完成电话关怀',
    secondaryPrompt: '开场建议：先说“我记得你昨晚没睡稳，我在这儿。”',
    evidence: [
      { id: 'e1-photo', type: 'photo', title: '现场片段', content: '早晨窗边独坐照片（占位）' },
      { id: 'e1-quote', type: 'quote', title: '原话线索', content: '“这两晚总是醒，心里空空的。”' },
      { id: 'e1-data', type: 'data', title: '轻量数据', content: '48h 内睡眠相关表达 3 次 ↑' },
    ],
  },
  {
    id: 'decision-2',
    tier: 'attention',
    processState: 'doing',
    time: '昨天 19:10',
    insightTag: '关系回避',
    insightText: '她在试探“会不会被持续关心”，建议先发语音再跟进。',
    actionType: 'voice',
    contactName: '妈妈',
    actionLabel: '发一段 30 秒语音',
    actionDoneText: '已完成语音关怀',
    secondaryPrompt: '语音建议：先共情，再约定明晚继续聊。',
    evidence: [
      { id: 'e2-quote', type: 'quote', title: '原话线索', content: '“你们忙就别管我了。”24h 内出现 2 次。' },
      { id: 'e2-data', type: 'data', title: '轻量数据', content: '回复间隔 10min -> 25min' },
    ],
  },
  {
    id: 'decision-3',
    tier: 'attention',
    processState: 'todo',
    time: '03/26 11:30',
    insightTag: '社交意愿',
    insightText: '本周多次提到想见老邻居，今天适合直接敲定时间。',
    actionType: 'visit',
    contactName: '妈妈',
    actionLabel: '安排周末回访',
    actionDoneText: '已完成回访安排',
    evidence: [
      { id: 'e3-photo', type: 'photo', title: '生活片段', content: '翻看旧相册照片（占位）' },
      { id: 'e3-quote', type: 'quote', title: '原话线索', content: '“改天见见老邻居就好了。”' },
    ],
  },
  {
    id: 'decision-4',
    tier: 'reminder',
    processState: 'done',
    time: '03/25 14:20',
    insightTag: '长期备忘',
    insightText: '药盒补充提醒仍有效，明天上午复核即可。',
    actionType: 'visit',
    contactName: '妈妈',
    actionLabel: '查看备忘',
    actionDoneText: '提醒已确认',
    evidence: [
      { id: 'e4-data', type: 'data', title: '提醒状态', content: '上次补充：2 天前' },
    ],
  },
]

export function createDecisionSessions(): DecisionSessionVM[] {
  return decisionSessionsSeed.map((session) => ({ ...session, evidence: session.evidence.map((item) => ({ ...item })) }))
}

export const recentStatusCardsSeed: RecentStatusCardVM[] = decisionSessionsSeed.map((session) => ({
  id: session.id,
  time: session.time,
  level: session.tier,
  title: session.insightText,
  description: session.secondaryPrompt ?? '建议先联系，再根据反馈调整。',
  reason: session.insightText,
  suggestedAction: session.actionType,
  processState: session.processState,
  evidence: session.evidence.map((item) => item.content),
}))

export const emptyRecentStatusCardsSeed: RecentStatusCardVM[] = []

export const allDoneRecentStatusCardsSeed: RecentStatusCardVM[] = recentStatusCardsSeed.map((card) => ({
  ...card,
  processState: 'done',
}))

export function createRecentStatusCards(): RecentStatusCardVM[] {
  return recentStatusCardsSeed.map((card) => ({ ...card, evidence: [...card.evidence] }))
}

export function createAllDoneRecentStatusCards(): RecentStatusCardVM[] {
  return allDoneRecentStatusCardsSeed.map((card) => ({ ...card, evidence: [...card.evidence] }))
}

export const statusItems: StatusItem[] = recentStatusCardsSeed.slice(0, 2).map((item) => ({
  time: item.time,
  title: item.title,
  detail: item.reason,
}))
