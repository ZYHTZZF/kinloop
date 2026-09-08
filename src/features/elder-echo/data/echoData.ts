import type {
  EchoGreeting,
  EchoItem,
  EchoQuickReplyOption,
  EchoSessionVM,
  FamilyEchoCardVM,
  MemoryEchoCardVM,
} from '../types'

export const elderEchoGreeting: EchoGreeting = {
  salutation: '张阿姨，早上好。',
  guidance: '今天有人认真记得你说过的话，我们慢慢看。',
}

export const echoSessionsSeed: EchoSessionVM[] = [
  {
    id: 'session-1',
    familyName: '女儿小雯',
    source: '晨间回应',
    time: '今天 08:15',
    greetingMeta: '她先接住了你昨晚“睡不踏实”的那句话。',
    echoBody: '昨晚你说凌晨醒了两次，我记在心里了。今晚我给你发一段放松语音，我们一起试试慢慢睡稳。',
    voiceTranscription: '语音转写：妈，你别急，我们一点点调。',
    inputHint: '想回一句就从“我听到了”开始，也可以按住麦克风慢慢说。',
    context: {
      lead: '触发原话',
      quote: '“这两晚总是醒，心里也有点空。”',
      time: '昨晚 22:08',
    },
    memorySnippet: {
      tag: '相关回忆',
      text: '上周你说“听到她的声音就安心些”。',
      photoHint: '旧照片：上周视频通话截图',
    },
    status: 'new',
    canContinue: true,
    snoozed: false,
    latest: true,
  },
  {
    id: 'session-2',
    familyName: '儿子阿杰',
    source: '午间关心',
    time: '昨天 12:40',
    echoBody: '你提到公园那条路熟悉，我周六上午陪你再走一遍。我们慢一点走，顺便拍几张花开的照片。',
    inputHint: '可以继续补充你想看的那片花。',
    context: {
      lead: '触发原话',
      quote: '“拐角那棵树我总记得。”',
      time: '前天 18:22',
    },
    memorySnippet: {
      tag: '回忆碎片',
      text: '你说过“那条路像年轻时下班回家的路”。',
    },
    status: 'viewed',
    canContinue: false,
    snoozed: false,
    latest: false,
  },
  {
    id: 'session-3',
    familyName: '外孙乐乐',
    source: '晚安回复',
    time: '03/24 20:10',
    echoBody: '你讲的旧电影我今天也去找来看了，我记住了你最喜欢的那句台词。下次你再讲，我想多听一点。',
    inputHint: '想继续聊电影，可以从那句台词开始。',
    context: {
      lead: '触发原话',
      quote: '“这句台词我年轻时一直记着。”',
      time: '03/23 21:03',
    },
    memorySnippet: {
      tag: '旧线索',
      text: '你们上次聊到《小城之春》。',
    },
    status: 'replied',
    canContinue: false,
    snoozed: true,
    latest: false,
  },
]

export const echoQuickReplyOptions: EchoQuickReplyOption[] = [
  { id: 'reply-1', label: '我听到了，谢谢你记着我。' },
  { id: 'reply-2', label: '晚上我们再慢慢聊。' },
  { id: 'reply-3', label: '这句我很喜欢，你再多讲一点。' },
]

export function createEchoSessions(): EchoSessionVM[] {
  return echoSessionsSeed.map((session) => ({
    ...session,
    context: { ...session.context },
    memorySnippet: session.memorySnippet ? { ...session.memorySnippet } : undefined,
  }))
}

export const familyEchoCardsSeed: FamilyEchoCardVM[] = [
  {
    id: 'family-1',
    tab: 'family',
    source: '女儿晨间留言',
    time: '今天 08:15',
    title: '你昨天说睡得浅，我记着了',
    summary: '今晚我下班后给你发一段放松语音，一起试试。',
    detail:
      '昨晚你提到凌晨醒了两次。我今天已经把舒缓音乐准备好，晚上 9 点前发给你，我们慢慢调整作息。',
    status: 'new',
    primaryAction: 'quick_reply',
    secondaryActions: ['listen', 'continue_talk'],
  },
  {
    id: 'family-2',
    tab: 'family',
    source: '儿子午间关心',
    time: '昨天 12:40',
    title: '公园那条路我周末陪你再走一遍',
    summary: '你提到想看花开，我周六上午陪你去。',
    detail:
      '你前天提到公园长椅旁边的花开了，我已经把周六上午留出来。我们慢一点走，顺便拍几张照片。',
    status: 'viewed',
    primaryAction: 'quick_reply',
    secondaryActions: ['listen', 'continue_talk'],
  },
  {
    id: 'family-3',
    tab: 'family',
    source: '外孙晚安回复',
    time: '03/24 20:10',
    title: '你讲的旧电影我今天也去找来看了',
    summary: '我也记住了你喜欢的那句台词。',
    detail:
      '你前晚说到《小城之春》的那句台词，我今天和同学聊到了。谢谢你一直给我讲这些故事。',
    status: 'replied',
    primaryAction: 'quick_reply',
    secondaryActions: ['listen', 'continue_talk'],
  },
]

export const memoryEchoCardsSeed: MemoryEchoCardVM[] = [
  {
    id: 'memory-1',
    tab: 'memory',
    source: '我的回忆',
    time: '今天 09:05',
    topic: '年轻时的工作伙伴',
    promptText: '你上次提到老同事小周，想起了什么开心片段？',
    detail:
      '你说起第一次带新人时很紧张，后来大家一起加班吃面。这个故事可以从“那晚谁先开玩笑”继续说。',
    status: 'can_continue',
    primaryAction: 'continue_talk',
    secondaryActions: ['snooze_memory'],
  },
  {
    id: 'memory-2',
    tab: 'memory',
    source: '系统记录',
    time: '昨天 16:20',
    topic: '公园散步路线',
    promptText: '你说过“拐角那棵树很熟悉”，要不要从那里继续讲？',
    detail:
      '上次在这里停住时，你讲到“年轻时常走这条路”。下次可以从“为什么熟悉”继续，内容会更连贯。',
    status: 'snoozed',
    primaryAction: 'continue_talk',
    secondaryActions: ['snooze_memory'],
  },
]

export const emptyFamilyEchoCardsSeed: FamilyEchoCardVM[] = []
export const emptyMemoryEchoCardsSeed: MemoryEchoCardVM[] = []

export function createFamilyEchoCards(): FamilyEchoCardVM[] {
  return familyEchoCardsSeed.map((card) => ({ ...card }))
}

export function createMemoryEchoCards(): MemoryEchoCardVM[] {
  return memoryEchoCardsSeed.map((card) => ({ ...card }))
}

export const echoItems: EchoItem[] = [
  {
    source: '家人回应',
    title: familyEchoCardsSeed[0].title,
    detail: familyEchoCardsSeed[0].summary,
  },
  {
    source: '我的回忆',
    title: memoryEchoCardsSeed[0].topic,
    detail: memoryEchoCardsSeed[0].promptText,
  },
]
