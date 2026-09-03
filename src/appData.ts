export type SiteView = 'marketing' | 'family' | 'elder'
export type TaskStage = 'ready' | 'executing' | 'done'
export type VoiceState = 'idle' | 'recording' | 'transcribing'
export type FollowupReply = 'none' | 'better' | 'worse' | 'talk' | 'later'

export type FamilyPage = 'home' | 'care' | 'contact' | 'script' | 'collab' | 'privacy'
export type ElderPage = 'home' | 'talk' | 'memory' | 'greeting' | 'help'

export type EntryCard<T extends string> = {
  id: T
  title: string
  summary: string
  badge: string
  detail: string
}

export const siteTabs = [
  { id: 'marketing', label: '官网' },
  { id: 'family', label: '家人端' },
  { id: 'elder', label: '长辈端' },
] as const satisfies readonly { id: SiteView; label: string }[]

export const familyPages = [
  {
    id: 'care',
    title: '今日关怀',
    badge: '核心入口',
    summary: '每天最值得做的一步关心、最佳时间和动作建议都从这里开始。',
    detail: '承接情绪摘要、主任务、时间线和复盘。',
  },
  {
    id: 'contact',
    title: '即时联系',
    badge: '高频动作',
    summary: '发语音、发消息、约视频、电话联系，所有即时动作在这里统一发起。',
    detail: '后续接入真实消息和预约能力即可。',
  },
  {
    id: 'script',
    title: '关系脚本',
    badge: '差异化功能',
    summary: '不会开口、怕说错话时，这里给你结构、语气和雷区提示。',
    detail: '当前已具备脚本抽屉骨架，可继续扩展场景库。',
  },
  {
    id: 'collab',
    title: '家庭协作',
    badge: '协同入口',
    summary: '谁来联系、谁来兜底、谁来接力，分工和轮值都在这里组织。',
    detail: '适合后续接成员管理和任务分派。',
  },
  {
    id: 'privacy',
    title: '授权隐私',
    badge: '信任核心',
    summary: '哪些摘要可见、哪些原话不可见、哪些记忆会淡出，都在这里说明白。',
    detail: '后续可接细粒度权限和审计记录。',
  },
] as const satisfies readonly EntryCard<Exclude<FamilyPage, 'home'>>[]

export const elderPages = [
  {
    id: 'talk',
    title: '陪伴对话',
    badge: '核心入口',
    summary: '长辈想说话时，只要按住说话就能进入稳定、温柔的语音陪伴。',
    detail: '后续接对话流、TTS、主动回访即可。',
  },
  {
    id: 'memory',
    title: '回忆一下',
    badge: '被记住',
    summary: '最近提过的人和事、挂心的话题、想继续聊的内容，都从这里展开。',
    detail: '后续可接记忆详情、授权和删除操作。',
  },
  {
    id: 'greeting',
    title: '家人问候',
    badge: '被惦记',
    summary: '家人留给长辈的语音、照片和短句会安静地放在这里，不像聊天列表。',
    detail: '后续可接留言流和历史问候。',
  },
  {
    id: 'help',
    title: '需要帮忙',
    badge: '安心通道',
    summary: '联系家人、联系社区、我现在不舒服，都应该从这里一键到达。',
    detail: '后续只需接通联系人和兜底逻辑。',
  },
] as const satisfies readonly EntryCard<Exclude<ElderPage, 'home'>>[]

export const familyNavItems = ['今日关怀', '关系时间线', '家庭协作', '授权隐私'] as const
export const quickActions = ['发语音', '发消息', '约视频', '电话联系'] as const

export const timelineEvents = [
  {
    time: '03 / 17 晚',
    title: '提到昨晚睡不好',
    detail: '情绪偏低，话题集中在睡眠和疲惫感。',
  },
  {
    time: '03 / 18 早',
    title: '出现回避型表达',
    detail: '“你们忙，不用总惦记我”更像试探被持续关心。',
  },
  {
    time: '03 / 18 晚',
    title: '建议先发语音',
    detail: '适合先打开情绪连接，再进入身体层面的追问。',
  },
] as const

export const familyReviews = [
  '上次语音之后，她回复“听了挺开心”。',
  '晚上联系比白天更容易聊开。',
  '连续两天不跟进时，她会更倾向于说“没事”。',
] as const

export const scriptVariants = [
  {
    label: '温和版',
    opening: '妈，我刚下班，突然想到你昨天说没睡好，今天有没有舒服一点？',
    empathy: '你不想让我担心我知道，但你说出来，我心里会更踏实。',
    close: '我明晚再来问你，不让你一个人扛着。',
  },
  {
    label: '家常版',
    opening: '妈，刚刚路上想起你了，昨晚后来睡得好点没有？',
    empathy: '你慢慢说就行，我先听着，不着急。',
    close: '我一会儿忙完再给你留一句话，咱们接着聊。',
  },
  {
    label: '直接版',
    opening: '我记着你昨晚睡不好，今天我想先问问你现在怎么样。',
    empathy: '如果还难受，我们今天就别拖着，我陪你一起想办法。',
    close: '这件事我记住了，今晚我会继续跟进。',
  },
] as const

export const taskMeta: Record<
  TaskStage,
  {
    badge: string
    minor: string
    accentClass: string
    actionLabel: string
    hint: string
    helper: string
  }
> = {
  ready: {
    badge: '建议今晚完成',
    minor: '约 1 分钟',
    accentClass: 'task-card--ready',
    actionLabel: '加入今晚关怀清单',
    hint: '先别急着问身体，先从“昨晚睡得怎么样”开始。她现在更需要被接住，而不是被提醒。',
    helper: '你现在最适合做的是一条短语音，让她先感到“你记得”。',
  },
  executing: {
    badge: '正在执行',
    minor: '等待回填',
    accentClass: 'task-card--executing',
    actionLabel: '等待反馈…',
    hint: '保持语气温和、句子更短一点，会更容易让她继续说。',
    helper: '发送后记得回填结果，我会根据反馈安排下一步。',
  },
  done: {
    badge: '已完成',
    minor: '继续接力中',
    accentClass: 'task-card--done',
    actionLabel: '已加入明晚回访',
    hint: '这次联系已经建立了情绪连接，下一步更适合延续轻量陪伴，而不是追问细节。',
    helper: '系统已生成明晚 19:40 的轻回访草稿，你只需要继续沿用这种语气。',
  },
}

export const followupFeedback: Record<Exclude<FollowupReply, 'none'>, string> = {
  better: '那我就放心一点了。要是等会儿还不舒服，也可以再告诉我。',
  worse: '那我先记住这件事。如果你现在不舒服，我也可以帮你联系家人。',
  talk: '好呀，那我们就慢慢说，我会接着听。',
  later: '没关系，我晚一点再轻轻问你，你想说的时候再告诉我就好。',
}
