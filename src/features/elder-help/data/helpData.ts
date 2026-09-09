import type { EscalationStep, HelpAction, HelpRequestRecord } from '../types'

export const helpActions: HelpAction[] = [
  {
    label: '联系家人',
    tone: 'default',
    description: '优先通知最熟悉情况的家属，确认是否需要马上到场。',
  },
  {
    label: '社区协助',
    tone: 'default',
    description: '联系邻里、物业或社区站点，补位现场支持。',
  },
  {
    label: '紧急升级',
    tone: 'primary',
    description: '当风险持续上升时，直接切到高优先级处理流程。',
  },
]

export const helpRequests: HelpRequestRecord[] = [
  {
    id: 'help-101',
    title: '晚饭后头晕，需要确认是否有人能上门',
    summary: '先联系女儿，若 20 分钟内无法到场，再转社区志愿者。',
    requester: '李阿姨',
    channel: 'family',
    stage: 'contacting',
    responseGoal: '20 分钟内确认到场人选',
    lastUpdate: '18:40 已发送家属提醒',
  },
  {
    id: 'help-102',
    title: '药盒找不到，担心漏服晚间药',
    summary: '邻居可先帮忙查看抽屉位置，必要时补电话指导。',
    requester: '周叔叔',
    channel: 'neighbor',
    stage: 'scheduled',
    responseGoal: '今晚 19:30 前完成核对',
    lastUpdate: '19:05 邻居王姐已确认顺路上门',
  },
  {
    id: 'help-103',
    title: '凌晨起夜差点摔倒，需要评估持续风险',
    summary: '先登记一次高风险事件，再准备人工支持兜底。',
    requester: '陈奶奶',
    channel: 'service',
    stage: 'triaged',
    responseGoal: '形成后续 48 小时观察安排',
    lastUpdate: '今早 07:10 新增风险记录',
  },
]

export const escalationSteps: EscalationStep[] = [
  {
    label: '先确认是否安全',
    detail: '先问清楚有没有摔倒、胸闷、意识不清，再决定后续通道。',
  },
  {
    label: '尽量只切一个升级入口',
    detail: '避免同时通知多人导致重复赶往现场，把主联系人定清楚。',
  },
  {
    label: '保留回填信息',
    detail: '谁接了、几点到、有没有解决，都要为“继续关心”留下闭环记录。',
  },
]
