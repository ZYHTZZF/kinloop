import type {
  Alert,
  ConversationCard,
  ConversationDetail,
  FamilySpace,
  FollowupRecord,
  Member,
  MemoryEntry,
  Message,
  PermissionPolicy,
  Pulse,
} from './types'
import type { InviteCode } from './inviteApi'

type MockState = {
  familySpace: FamilySpace
  members: Member[]
  conversations: ConversationDetail[]
  memories: MemoryEntry[]
  pulses: Pulse[]
  followups: FollowupRecord[]
  alerts: Alert[]
  invites: InviteCode[]
  permissionPolicies: PermissionPolicy[]
}

const STORAGE_KEY = 'kinloop-mock-state-v1'

let memoryState: MockState | null = null

export async function mockApiGet<T>(path: string): Promise<T> {
  const state = getState()

  if (path === '/family-space') return state.familySpace as T
  if (path === '/members') return state.members as T
  if (path === '/conversations/cards') return buildConversationCards(state) as T
  if (path === '/memories') return [...state.memories].sort((a, b) => b.addedAt - a.addedAt) as T
  if (path === '/pulses/today') return [...state.pulses].sort((a, b) => b.createdAt - a.createdAt) as T
  if (path === '/pulses/history') return [...state.pulses].sort((a, b) => b.createdAt - a.createdAt) as T
  if (path === '/followups') return [...state.followups].sort((a, b) => b.createdAt - a.createdAt) as T
  if (path === '/alerts/active') {
    return state.alerts.filter((alert) => alert.status !== 'RESOLVED').sort((a, b) => b.triggeredAt - a.triggeredAt) as T
  }
  if (path === '/permission-policies') return state.permissionPolicies as T
  if (path === '/invites') return [...state.invites].sort((a, b) => b.createdAt - a.createdAt) as T

  const conversationMatch = path.match(/^\/conversations\/([^/]+)$/)
  if (conversationMatch) {
    const conversation = state.conversations.find((item) => item.id === conversationMatch[1])
    if (!conversation) {
      throw new Error('Conversation not found')
    }
    return clone(conversation) as T
  }

  throw new Error(`Mock route not implemented: GET ${path}`)
}

export async function mockApiPost<T>(path: string, body: unknown): Promise<T> {
  const state = getState()

  const messageMatch = path.match(/^\/conversations\/([^/]+)\/messages$/)
  if (messageMatch) {
    const conversation = state.conversations.find((item) => item.id === messageMatch[1])
    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const payload = body as Partial<Message>
    const now = Date.now()
    const nextMessage: Message = {
      id: `msg_${now}`,
      conversationId: conversation.id,
      senderType: String(payload.senderType ?? 'Family'),
      senderMemberId: (payload.senderMemberId as string | null) ?? conversation.memberId,
      messageType: String(payload.messageType ?? 'Text'),
      textContent: (payload.textContent as string | null) ?? null,
      mediaUrl: (payload.mediaUrl as string | null) ?? null,
      voiceDurationSec: (payload.voiceDurationSec as number | null) ?? null,
      transcript: (payload.transcript as string | null) ?? null,
      transcriptConfidence: (payload.transcriptConfidence as number | null) ?? null,
      aiDrafted: Boolean(payload.aiDrafted),
      status: 'DELIVERED',
      isLowInformation: Boolean(payload.isLowInformation),
      createdAt: now,
      deliveredAt: now,
      consumedAt: null,
      recalledAt: null,
    }

    conversation.messages.push(nextMessage)
    persist(state)
    return clone(conversation) as T
  }

  if (path === '/memories') {
    const payload = body as Partial<MemoryEntry>
    const now = Date.now()
    const nextMemory: MemoryEntry = {
      id: `memory_${now}`,
      familySpaceId: String(payload.familySpaceId ?? state.familySpace.id),
      sourceConvId: (payload.sourceConvId as string | null) ?? null,
      sourceMsgId: (payload.sourceMsgId as string | null) ?? null,
      addedByMemberId: String(payload.addedByMemberId ?? 'member_daughter'),
      addedAt: now,
      memoryType: String(payload.memoryType ?? 'Text'),
      title: (payload.title as string | null) ?? '新保存的一段内容',
      description: (payload.description as string | null) ?? null,
      mediaUrl: (payload.mediaUrl as string | null) ?? null,
      status: 'ACTIVE',
      visibleScope: 'Family',
      createdAt: now,
      updatedAt: now,
    }
    state.memories.unshift(nextMemory)
    persist(state)
    return clone(nextMemory) as T
  }

  if (path === '/followups') {
    const payload = body as Partial<FollowupRecord> & { linkedPulseId?: string | null }
    const now = Date.now()
    const nextFollowup: FollowupRecord = {
      id: `followup_${now}`,
      linkedPulseId: payload.linkedPulseId ?? null,
      linkedAlertId: (payload.linkedAlertId as string | null) ?? null,
      handlerMemberId: String(payload.handlerMemberId ?? 'member_daughter'),
      actionType: String(payload.actionType ?? 'Chat'),
      resultTag: (payload.resultTag as string | null) ?? '已处理',
      resultNote: (payload.resultNote as string | null) ?? '已完成一次跟进。',
      status: 'DONE',
      createdAt: now,
    }
    state.followups.unshift(nextFollowup)
    if (nextFollowup.linkedPulseId) {
      const pulse = state.pulses.find((item) => item.id === nextFollowup.linkedPulseId)
      if (pulse) {
        pulse.status = 'RESOLVED'
        pulse.resolvedAt = now
      }
    }
    persist(state)
    return clone(nextFollowup) as T
  }

  if (path === '/alerts') {
    const payload = body as Partial<Alert>
    const now = Date.now()
    const nextAlert: Alert = {
      id: `alert_${now}`,
      familySpaceId: String(payload.familySpaceId ?? state.familySpace.id),
      alertType: String(payload.alertType ?? 'UNWELL'),
      triggerSource: String(payload.triggerSource ?? 'Voice'),
      status: 'TRIGGERED',
      acknowledgedBy: null,
      triggeredAt: now,
      countdownDeadlineAt: now + 10 * 60 * 1000,
      escalationLevel: Number(payload.escalationLevel ?? 1),
      resolvedAt: null,
      resolutionNote: null,
    }
    state.alerts.unshift(nextAlert)
    persist(state)
    return clone(nextAlert) as T
  }

  if (path === '/invites') {
    const payload = body as Partial<InviteCode>
    const now = Date.now()
    const nextInvite: InviteCode = {
      id: `invite_${now}`,
      familySpaceId: String(payload.familySpaceId ?? state.familySpace.id),
      code: `KIN${String(now).slice(-6)}`,
      status: 'ACTIVE',
      requestedRole: String(payload.requestedRole ?? 'Family'),
      createdByMemberId: String(payload.createdByMemberId ?? 'member_daughter'),
      approvedMemberId: 'member_daughter',
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      createdAt: now,
      approvedAt: now,
    }
    state.invites.unshift(nextInvite)
    persist(state)
    return clone(nextInvite) as T
  }

  throw new Error(`Mock route not implemented: POST ${path}`)
}

export async function mockApiPatch<T>(path: string, body: unknown): Promise<T> {
  const state = getState()

  const acknowledgeMatch = path.match(/^\/alerts\/([^/]+)\/acknowledge$/)
  if (acknowledgeMatch) {
    const alert = state.alerts.find((item) => item.id === acknowledgeMatch[1])
    if (!alert) throw new Error('Alert not found')
    const payload = body as { memberId?: string }
    alert.status = 'HANDLING'
    alert.acknowledgedBy = payload.memberId ?? 'member_daughter'
    persist(state)
    return clone(alert) as T
  }

  const resolveMatch = path.match(/^\/alerts\/([^/]+)\/resolve$/)
  if (resolveMatch) {
    const alert = state.alerts.find((item) => item.id === resolveMatch[1])
    if (!alert) throw new Error('Alert not found')
    const payload = body as { resolutionNote?: string }
    alert.status = 'RESOLVED'
    alert.resolutionNote = payload.resolutionNote ?? '已完成处理。'
    alert.resolvedAt = Date.now()
    persist(state)
    return clone(alert) as T
  }

  const approveMatch = path.match(/^\/invites\/([^/]+)\/approve$/)
  if (approveMatch) {
    const invite = state.invites.find((item) => item.id === approveMatch[1])
    if (!invite) throw new Error('Invite not found')
    const payload = body as { approvedMemberId?: string }
    invite.status = 'ACTIVE'
    invite.approvedMemberId = payload.approvedMemberId ?? 'member_daughter'
    invite.approvedAt = Date.now()
    persist(state)
    return clone(invite) as T
  }

  throw new Error(`Mock route not implemented: PATCH ${path}`)
}

function buildConversationCards(state: MockState): ConversationCard[] {
  return state.conversations
    .map((conversation) => {
      const lastMessage = [...conversation.messages].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
      const unreadCount = conversation.messages.filter(
        (message) => message.senderType !== 'Family' && !message.consumedAt,
      ).length

      return {
        id: conversation.id,
        conversationType: conversation.conversationType,
        memberId: conversation.memberId,
        familyMemberId: conversation.familyMemberId,
        elderMemberId: conversation.elderMemberId,
        name: conversation.name,
        familyDisplayName: conversation.familyDisplayName,
        elderDisplayName: conversation.elderDisplayName,
        avatar: conversation.avatar,
        lastActivityAt: lastMessage?.createdAt ?? null,
        unreadCount,
        unreadSummary: unreadCount > 0 ? `还有 ${unreadCount} 条新消息` : '最近没有新消息',
        primaryMessage: lastMessage
          ? {
              id: lastMessage.id,
              type: normalizeMessageType(lastMessage.messageType),
              preview: buildPrimaryPreview(lastMessage),
              mediaLabel: buildPrimaryMediaLabel(lastMessage),
            }
          : null,
      }
    })
    .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
}

function normalizeMessageType(messageType: string): 'text' | 'image' | 'voice' | 'video' {
  if (messageType === 'Image') return 'image'
  if (messageType === 'Voice') return 'voice'
  if (messageType === 'Video') return 'video'
  return 'text'
}

function buildPrimaryPreview(message: Message) {
  if (message.textContent) return message.textContent
  if (message.messageType === 'Voice') return message.transcript ?? '发来一条语音'
  if (message.messageType === 'Image') return '发来一张图片'
  if (message.messageType === 'Video') return '发来一段视频'
  return message.mediaUrl ?? '发来一条新内容'
}

function buildPrimaryMediaLabel(message: Message) {
  if (message.messageType === 'Image') return '图片'
  if (message.messageType === 'Video') return '视频'
  return null
}
function getState() {
  if (memoryState) return memoryState

  const stored = safeGetStorage()
  if (stored) {
    memoryState = stored
    return memoryState
  }

  memoryState = buildInitialState()
  persist(memoryState)
  return memoryState
}

function persist(state: MockState) {
  memoryState = clone(state)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState))
  }
}

function safeGetStorage(): MockState | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as MockState
  } catch {
    return null
  }
}

function buildInitialState(): MockState {
  const now = Date.now()
  const hour = 60 * 60 * 1000
  const familySpace: FamilySpace = {
    id: 'fs_demo',
    name: '汤先生一家',
    elderDisplayName: '汤老先生',
    primaryMemberId: 'member_daughter',
    createdAt: now - 30 * 24 * hour,
    updatedAt: now,
  }

  const members: Member[] = [
    {
      id: 'member_daughter',
      familySpaceId: familySpace.id,
      role: 'Primary',
      displayName: '大女儿',
      elderAlias: '女儿',
      phone: '13800000001',
      lastActivityAt: now - 5 * hour,
      alertPriority: 1,
      status: 'Active',
    },
    {
      id: 'member_son',
      familySpaceId: familySpace.id,
      role: 'Family',
      displayName: '儿子',
      elderAlias: '儿子',
      phone: '13800000002',
      lastActivityAt: now - 30 * hour,
      alertPriority: 2,
      status: 'Active',
    },
    {
      id: 'member_granddaughter',
      familySpaceId: familySpace.id,
      role: 'Family',
      displayName: '孙女',
      elderAlias: '孙女',
      phone: null,
      lastActivityAt: now - 12 * hour,
      alertPriority: 3,
      status: 'Active',
    },
  ]

  const conversations: ConversationDetail[] = [
    {
      id: 'daughter',
      conversationType: 'FAMILY_CHAT',
      memberId: 'member_daughter',
      familyMemberId: 'member_daughter',
      elderMemberId: 'member_elder',
      name: 'daughter',
      familyDisplayName: '大女儿',
      elderDisplayName: '汤老先生',
      avatar: '女',
      messages: [
        makeMessage('msg_d1', 'daughter', 'Elder', null, 'Text', '女儿，中午回不回来吃饭？', now - 6 * hour),
        makeMessage('msg_d2', 'daughter', 'Family', 'member_daughter', 'Text', '我中午不回去了，晚上给您带点水果。', now - 5.5 * hour),
        makeMessage('msg_d3', 'daughter', 'Elder', null, 'Voice', null, now - 4 * hour, '那你晚上早点回来。'),
      ],
    },
    {
      id: 'son',
      conversationType: 'FAMILY_CHAT',
      memberId: 'member_son',
      familyMemberId: 'member_son',
      elderMemberId: 'member_elder',
      name: 'son',
      familyDisplayName: '儿子',
      elderDisplayName: '汤老先生',
      avatar: '子',
      messages: [
        makeMessage('msg_s1', 'son', 'Family', 'member_son', 'Image', '今天路过公园拍的花。', now - 26 * hour, null, '公园照片'),
        makeMessage('msg_s2', 'son', 'Elder', null, 'Text', '花开得真好，看着心情都好了。', now - 24 * hour),
      ],
    },
    {
      id: 'granddaughter',
      conversationType: 'FAMILY_CHAT',
      memberId: 'member_granddaughter',
      familyMemberId: 'member_granddaughter',
      elderMemberId: 'member_elder',
      name: 'granddaughter',
      familyDisplayName: '孙女',
      elderDisplayName: '汤老先生',
      avatar: '孙',
      messages: [
        makeMessage('msg_g1', 'granddaughter', 'Family', 'member_granddaughter', 'Text', '爷爷，我今天比赛拿奖啦。', now - 10 * hour),
        makeMessage('msg_g2', 'granddaughter', 'Elder', null, 'Text', '真厉害，照片发给我看看。', now - 9.5 * hour),
      ],
    },
  ]

  const pulses: Pulse[] = [
    {
      id: 'pulse_high_1',
      familySpaceId: familySpace.id,
      sourceType: 'Voice',
      pulseType: 'Unwell',
      severity: 'HIGH',
      summary: '长辈提到有点胸闷，建议尽快确认。',
      sourceConversationId: 'daughter',
      status: 'OPEN',
      createdAt: now - 3 * hour,
      resolvedAt: null,
    },
    {
      id: 'pulse_medium_1',
      familySpaceId: familySpace.id,
      sourceType: 'Chat',
      pulseType: 'Emotion',
      severity: 'MEDIUM',
      summary: '长辈今天明显更想让家里人多说几句。',
      sourceConversationId: 'granddaughter',
      status: 'OPEN',
      createdAt: now - 8 * hour,
      resolvedAt: null,
    },
    {
      id: 'pulse_low_1',
      familySpaceId: familySpace.id,
      sourceType: 'Chat',
      pulseType: 'Routine',
      severity: 'LOW',
      summary: '今天上午状态平稳，正常聊天互动。',
      sourceConversationId: 'son',
      status: 'RESOLVED',
      createdAt: now - 14 * hour,
      resolvedAt: now - 12 * hour,
    },
  ]

  const followups: FollowupRecord[] = [
    {
      id: 'followup_seed_1',
      linkedPulseId: 'pulse_low_1',
      linkedAlertId: null,
      handlerMemberId: 'member_son',
      actionType: 'Chat',
      resultTag: '已记录',
      resultNote: '上午已经简单回了一句，状态比较平稳。',
      status: 'DONE',
      createdAt: now - 12 * hour,
    },
  ]

  const alerts: Alert[] = [
    {
      id: 'alert_seed_1',
      familySpaceId: familySpace.id,
      alertType: 'UNWELL',
      triggerSource: 'Voice',
      status: 'TRIGGERED',
      acknowledgedBy: null,
      triggeredAt: now - 2.5 * hour,
      countdownDeadlineAt: now + 30 * 60 * 1000,
      escalationLevel: 1,
      resolvedAt: null,
      resolutionNote: null,
    },
  ]

  const memories: MemoryEntry[] = [
    {
      id: 'memory_seed_1',
      familySpaceId: familySpace.id,
      sourceConvId: 'son',
      sourceMsgId: 'msg_s1',
      addedByMemberId: 'member_daughter',
      addedAt: now - 20 * hour,
      memoryType: 'Image',
      title: '儿子发来的公园照片',
      description: '长辈看到这张照片后心情不错。',
      mediaUrl: '公园照片',
      status: 'ACTIVE',
      visibleScope: 'Family',
      createdAt: now - 20 * hour,
      updatedAt: now - 20 * hour,
    },
  ]

  const invites: InviteCode[] = [
    {
      id: 'invite_seed_1',
      familySpaceId: familySpace.id,
      code: 'KIN826531',
      status: 'PENDING',
      requestedRole: 'Family',
      createdByMemberId: 'member_daughter',
      approvedMemberId: null,
      expiresAt: now + 5 * 24 * hour,
      createdAt: now - 6 * hour,
      approvedAt: null,
    },
  ]

  const permissionPolicies: PermissionPolicy[] = [
    {
      id: 'policy_primary',
      familySpaceId: familySpace.id,
      role: 'Primary',
      canViewPulse: 1,
      canViewFollowup: 1,
      canViewMemory: 1,
      canReceiveSos: 1,
      canReceiveUnwell: 1,
      canManageMembers: 1,
      canManageAlertOrder: 1,
    },
    {
      id: 'policy_family',
      familySpaceId: familySpace.id,
      role: 'Family',
      canViewPulse: 1,
      canViewFollowup: 1,
      canViewMemory: 1,
      canReceiveSos: 1,
      canReceiveUnwell: 1,
      canManageMembers: 0,
      canManageAlertOrder: 0,
    },
  ]

  return {
    familySpace,
    members,
    conversations,
    memories,
    pulses,
    followups,
    alerts,
    invites,
    permissionPolicies,
  }
}
function makeMessage(
  id: string,
  conversationId: string,
  senderType: string,
  senderMemberId: string | null,
  messageType: string,
  textContent: string | null,
  createdAt: number,
  transcript?: string | null,
  mediaUrl?: string | null,
): Message {
  return {
    id,
    conversationId,
    senderType,
    senderMemberId,
    messageType,
    textContent,
    mediaUrl: mediaUrl ?? null,
    voiceDurationSec: messageType === 'Voice' ? 8 : null,
    transcript: transcript ?? null,
    transcriptConfidence: transcript ? 0.94 : null,
    aiDrafted: false,
    status: 'DELIVERED',
    isLowInformation: false,
    createdAt,
    deliveredAt: createdAt,
    consumedAt: senderType === 'Family' ? null : createdAt,
    recalledAt: null,
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

