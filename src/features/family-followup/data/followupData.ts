import type { ClosureAction, FollowupRecord, FollowupTask } from '../types'

export const followupTasks: FollowupTask[] = [
  {
    label: '一键确认已联系',
    detail: '子女只需要先确认有没有接住这次求助，不必先写长段回填。',
    outcome: '把“有没有人回应”这件事先做掉。',
  },
  {
    label: '一键安排下次跟进',
    detail: '把回访变成一个按钮动作，而不是一堆字段录入。',
    outcome: '减轻子女操作负担，同时保留持续关心节奏。',
  },
  {
    label: '必要时重新升级',
    detail: '如果风险没有下降，就直接点按钮推回高优先级支持。',
    outcome: '让闭环不是硬结束，而是可以回到帮助链路。',
  },
]

export const followupRecords: FollowupRecord[] = [
  {
    id: 'follow-201',
    elderName: '李阿姨',
    trigger: '晚饭后头晕，已通知女儿',
    status: 'waiting',
    nextTouchpoint: '等待家属先回电确认',
    owner: '女儿',
    summary: '这次求助刚进入继续关心，先确认是否已经接住。',
  },
  {
    id: 'follow-202',
    elderName: '周叔叔',
    trigger: '药盒找不到，邻居已上门协助',
    status: 'in_progress',
    nextTouchpoint: '明早 08:00 再确认是否按时服药',
    owner: '外甥',
    summary: '现场问题暂时处理了，但还需要一轮轻量回访。',
  },
  {
    id: 'follow-203',
    elderName: '陈奶奶',
    trigger: '凌晨险些摔倒，需要连续观察',
    status: 'escalated',
    nextTouchpoint: '未来 48 小时每天晚饭后回访一次',
    owner: '社区站点',
    summary: '风险还没有下去，当前仍按升级状态处理。',
  },
]

export const closureActions: ClosureAction[] = [
  {
    label: '先接住，再细化',
    detail: '按钮式操作先解决“有没有回应”，必要时再补详细信息。',
  },
  {
    label: '轻量但不断线',
    detail: '不是把跟进做成表单系统，而是把它做成可以持续点击推进的轻处理台。',
  },
]
