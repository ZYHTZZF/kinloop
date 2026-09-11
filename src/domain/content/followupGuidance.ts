export type FollowupTask = {
  label: string
  detail: string
  outcome: string
}

export type ClosureAction = {
  label: string
  detail: string
}

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
