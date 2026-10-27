import { getDatabase } from '../db/index.mjs'
import { createEntityId } from '../services/auth/tokenService.mjs'

const FAMILY_GROUP_NAME = '相亲相爱一家人'
const HUMAN_MEMBER_ROLES = new Set(['Elder', 'Primary', 'Family', 'Trusted'])
const PRIVATE_CHAT_MEMBER_ROLES = new Set(['Primary', 'Family', 'Trusted'])

function looksGarbled(text) {
  if (typeof text !== 'string' || !text) return false
  if (text.includes('?')) return true
  const questionMarks = (text.match(/\?/g) || []).length
  const cjkChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return questionMarks >= 3 && cjkChars === 0
}

function sanitizeText(text, fallback = '') {
  if (typeof text !== 'string' || !text) {
    return text ?? null
  }

  return looksGarbled(text) ? fallback : text
}

function isGroupConversation(conversationType) {
  return conversationType === 'FAMILY_GROUP'
}

function isAiConversation(conversationType) {
  return conversationType === 'AI_ASSISTANT'
}

function normalizeMessageType(messageType) {
  const normalized = `${messageType ?? ''}`.toLowerCase()
  if (normalized === 'image') return 'image'
  if (normalized === 'voice') return 'voice'
  if (normalized === 'video') return 'video'
  return 'text'
}

function buildMessagePreview(message) {
  if (!message) {
    return ''
  }

  if (message.messageType === 'Voice') {
    return message.transcript ?? '发来了一条语音'
  }

  if (message.messageType === 'Image') {
    return message.textContent ?? '发来了一张图片'
  }

  if (message.messageType === 'Video') {
    return message.textContent ?? '发来了一段视频'
  }

  return sanitizeText(message.textContent, '新消息') ?? ''
}

function mapParticipant(row) {
  return {
    id: row.id,
    role: row.role,
    displayName: sanitizeText(row.displayName) ?? '',
    relationLabel: sanitizeText(row.relationLabel) ?? null,
    elderAlias: sanitizeText(row.elderAlias) ?? null,
    avatar: (sanitizeText(row.displayName) ?? '').trim().charAt(0) || '家',
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderType: row.senderType,
    senderMemberId: row.senderMemberId,
    senderDisplayName: sanitizeText(row.senderDisplayName) ?? null,
    senderRole: row.senderRole ?? null,
    messageType: row.messageType,
    textContent: sanitizeText(row.textContent),
    mediaUrl: row.mediaUrl,
    voiceDurationSec: row.voiceDurationSec,
    transcript: sanitizeText(row.transcript),
    transcriptConfidence: row.transcriptConfidence,
    aiDrafted: Boolean(row.aiDrafted),
    status: row.status,
    isLowInformation: Boolean(row.isLowInformation),
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt,
    consumedAt: row.viewerConsumedAt ?? row.legacyConsumedAt ?? null,
    recalledAt: row.recalledAt,
    emotion: row.emotion ?? null,
  }
}

function buildPrimaryMessage(message, conversationType) {
  if (!message) {
    return null
  }

  const preview = buildMessagePreview(message)
  const senderPrefix = isGroupConversation(conversationType) && message.senderDisplayName
    ? `${message.senderDisplayName}: `
    : ''

  if (message.messageType === 'Voice') {
    return {
      id: message.id,
      type: 'voice',
      preview: `${senderPrefix}${preview}`,
      mediaLabel: null,
    }
  }

  if (message.messageType === 'Image') {
    return {
      id: message.id,
      type: 'image',
      preview: `${senderPrefix}${preview}`,
      mediaLabel: '图片',
    }
  }

  if (message.messageType === 'Video') {
    return {
      id: message.id,
      type: 'video',
      preview: `${senderPrefix}${preview}`,
      mediaLabel: '视频',
    }
  }

  return {
    id: message.id,
    type: 'text',
    preview: `${senderPrefix}${preview}`,
    mediaLabel: message.mediaUrl ?? null,
  }
}

function buildUnreadSummary(messages) {
  const counts = { image: 0, voice: 0, video: 0, text: 0 }

  for (const message of messages) {
    counts[normalizeMessageType(message.messageType)] += 1
  }

  const parts = []
  if (counts.image > 0) parts.push(`还有 ${counts.image} 张图片`)
  if (counts.video > 0) parts.push(`还有 ${counts.video} 条视频`)
  if (counts.voice > 0) parts.push(`还有 ${counts.voice} 条语音`)
  if (counts.text > 0) parts.push(`还有 ${counts.text} 条文字`)

  return parts.join('，') || '暂无未读'
}

function getConversationTitle(conversation) {
  if (isGroupConversation(conversation.conversationType)) {
    return FAMILY_GROUP_NAME
  }

  if (isAiConversation(conversation.conversationType)) {
    return sanitizeText(conversation.familyDisplayName) || 'AI助手'
  }

  return sanitizeText(conversation.familyMemberAlias) || sanitizeText(conversation.familyDisplayName) || '聊天'
}

function getConversationAvatar(conversation) {
  const title = getConversationTitle(conversation)
  return title.trim().charAt(0) || '聊'
}

function getViewerMemberId(viewer, memberId, conversation = null) {
  if (memberId) {
    return memberId
  }

  if (viewer === 'elder') {
    return conversation?.elderMemberId ?? null
  }

  return conversation?.familyMemberId ?? null
}

function isUnreadMessageForViewer(message, viewer, viewerMemberId) {
  if (message.recalledAt || message.consumedAt) {
    return false
  }

  if (message.senderType === 'System' && !message.senderMemberId) {
    return false
  }

  if (viewerMemberId) {
    return message.senderMemberId !== viewerMemberId
  }

  return viewer === 'family' ? message.senderType === 'Elder' : message.senderType === 'Family'
}

function getUnreadMessagesForViewer(messages, conversation, viewer, memberId) {
  const viewerMemberId = getViewerMemberId(viewer, memberId, conversation)
  return messages.filter((message) => isUnreadMessageForViewer(message, viewer, viewerMemberId))
}

function fetchFamilyHumanMembers(db, familySpaceId) {
  return db.prepare(`
    select
      id,
      role,
      display_name as displayName,
      relation_label as relationLabel,
      elder_alias as elderAlias,
      last_activity_at as lastActivityAt
    from members
    where family_space_id = ?
      and role in ('Elder', 'Primary', 'Family', 'Trusted')
    order by
      case role
        when 'Elder' then 1
        when 'Primary' then 2
        when 'Family' then 3
        when 'Trusted' then 4
        else 5
      end,
      display_name asc
  `).all(familySpaceId)
}

function ensureConversationParticipants(db, conversationId, memberIds) {
  if (!conversationId || memberIds.length === 0) {
    return
  }

  const existingMemberIds = new Set(
    db.prepare(`
      select member_id as memberId
      from conversation_participants
      where conversation_id = ?
    `).all(conversationId).map((row) => row.memberId),
  )

  const insertParticipant = db.prepare(`
    insert into conversation_participants (id, conversation_id, member_id, joined_at)
    values (?, ?, ?, ?)
  `)

  const now = Date.now()
  for (const memberId of memberIds) {
    if (!memberId || existingMemberIds.has(memberId)) {
      continue
    }

    insertParticipant.run(createEntityId('participant'), conversationId, memberId, now)
  }
}

function ensureConversationReceipts(db, conversationId, participantIds) {
  if (!conversationId || participantIds.length === 0) {
    return
  }

  const messages = db.prepare(`
    select
      id,
      sender_member_id as senderMemberId,
      consumed_at as consumedAt
    from messages
    where conversation_id = ?
  `).all(conversationId)

  if (messages.length === 0) {
    return
  }

  const existingReceipts = new Set(
    db.prepare(`
      select
        message_receipts.message_id as messageId,
        message_receipts.member_id as memberId
      from message_receipts
      inner join messages on messages.id = message_receipts.message_id
      where messages.conversation_id = ?
    `).all(conversationId).map((row) => `${row.messageId}:${row.memberId}`),
  )

  const insertReceipt = db.prepare(`
    insert into message_receipts (id, message_id, member_id, consumed_at, created_at)
    values (?, ?, ?, ?, ?)
  `)

  for (const message of messages) {
    for (const participantId of participantIds) {
      if (!participantId || participantId === message.senderMemberId) {
        continue
      }

      const receiptKey = `${message.id}:${participantId}`
      if (existingReceipts.has(receiptKey)) {
        continue
      }

      insertReceipt.run(
        createEntityId('receipt'),
        message.id,
        participantId,
        message.consumedAt ?? null,
        message.consumedAt ?? Date.now(),
      )
    }
  }
}

function ensureConversationSeeds(db, familySpaceId) {
  if (!familySpaceId) {
    return
  }

  const humanMembers = fetchFamilyHumanMembers(db, familySpaceId)
  const elderMember = humanMembers.find((member) => member.role === 'Elder')

  if (!elderMember?.id) {
    return
  }

  const familyMembers = humanMembers.filter((member) => PRIVATE_CHAT_MEMBER_ROLES.has(member.role))
  const existingPrivateConversationMemberIds = new Set(
    db.prepare(`
      select family_member_id as familyMemberId
      from conversations
      where family_space_id = ?
        and conversation_type = 'FAMILY_CHAT'
    `).all(familySpaceId).map((row) => row.familyMemberId),
  )

  const insertConversation = db.prepare(`
    insert into conversations (
      id, family_space_id, elder_member_id, family_member_id, conversation_type, last_meaningful_activity_at, created_at
    ) values (?, ?, ?, ?, ?, ?, ?)
  `)

  const now = Date.now()
  for (const member of familyMembers) {
    if (!member?.id || existingPrivateConversationMemberIds.has(member.id)) {
      continue
    }

    insertConversation.run(
      createEntityId('conv'),
      familySpaceId,
      elderMember.id,
      member.id,
      'FAMILY_CHAT',
      member.lastActivityAt ?? null,
      now,
    )
  }

  const existingFamilyGroup = db.prepare(`
    select id
    from conversations
    where family_space_id = ?
      and conversation_type = 'FAMILY_GROUP'
    limit 1
  `).get(familySpaceId)

  if (!existingFamilyGroup) {
    insertConversation.run(
      `conv_family_group_${familySpaceId}`,
      familySpaceId,
      elderMember.id,
      familyMembers[0]?.id ?? elderMember.id,
      'FAMILY_GROUP',
      null,
      now,
    )
  }

  const conversationRows = db.prepare(`
    select
      id,
      conversation_type as conversationType,
      elder_member_id as elderMemberId,
      family_member_id as familyMemberId
    from conversations
    where family_space_id = ?
  `).all(familySpaceId)

  const humanMemberIds = humanMembers
    .filter((member) => HUMAN_MEMBER_ROLES.has(member.role))
    .map((member) => member.id)

  for (const conversation of conversationRows) {
    let participantIds = []

    if (conversation.conversationType === 'FAMILY_GROUP') {
      participantIds = humanMemberIds
    } else if (conversation.conversationType === 'AI_ASSISTANT') {
      participantIds = [conversation.elderMemberId].filter(Boolean)
    } else {
      participantIds = [conversation.elderMemberId, conversation.familyMemberId].filter(Boolean)
    }

    ensureConversationParticipants(db, conversation.id, participantIds)
    ensureConversationReceipts(db, conversation.id, participantIds)
  }
}

function fetchConversationParticipants(db, conversationId) {
  return db.prepare(`
    select
      members.id as id,
      members.role as role,
      members.display_name as displayName,
      members.relation_label as relationLabel,
      members.elder_alias as elderAlias
    from conversation_participants
    inner join members on members.id = conversation_participants.member_id
    where conversation_participants.conversation_id = ?
    order by
      case members.role
        when 'Elder' then 1
        when 'Primary' then 2
        when 'Family' then 3
        when 'Trusted' then 4
        else 5
      end,
      members.display_name asc
  `).all(conversationId).map(mapParticipant)
}

function resolveSenderType(db, familySpaceId, senderMemberId, senderType) {
  if (senderType === 'System') {
    return 'System'
  }

  if (!senderMemberId) {
    return senderType ?? 'System'
  }

  const member = db.prepare(`
    select role
    from members
    where id = ?
      and family_space_id = ?
    limit 1
  `).get(senderMemberId, familySpaceId)

  if (!member?.role) {
    return senderType ?? 'Family'
  }

  if (member.role === 'Elder') {
    return 'Elder'
  }

  if (member.role === 'AI') {
    return 'System'
  }

  return 'Family'
}

function fetchConversationRow(db, conversationId, familySpaceId) {
  return db.prepare(`
    select
      conversations.id as conversationId,
      conversations.conversation_type as conversationType,
      conversations.last_meaningful_activity_at as lastMeaningfulActivityAt,
      conversations.family_member_id as familyMemberId,
      conversations.elder_member_id as elderMemberId,
      family_member.display_name as familyDisplayName,
      family_member.elder_alias as familyMemberAlias,
      elder.display_name as elderDisplayName,
      family_spaces.elder_display_name as familySpaceElderDisplayName
    from conversations
    left join members as family_member on family_member.id = conversations.family_member_id
    left join members as elder on elder.id = conversations.elder_member_id
    inner join family_spaces on family_spaces.id = conversations.family_space_id
    where conversations.id = ?
      and conversations.family_space_id = ?
    limit 1
  `).get(conversationId, familySpaceId)
}

function fetchConversationRows(db, familySpaceId) {
  ensureConversationSeeds(db, familySpaceId)

  return db.prepare(`
    select
      conversations.id as conversationId,
      conversations.conversation_type as conversationType,
      conversations.last_meaningful_activity_at as lastMeaningfulActivityAt,
      conversations.family_member_id as familyMemberId,
      conversations.elder_member_id as elderMemberId,
      family_member.display_name as familyDisplayName,
      family_member.elder_alias as familyMemberAlias,
      elder.display_name as elderDisplayName,
      family_spaces.elder_display_name as familySpaceElderDisplayName
    from conversations
    left join members as family_member on family_member.id = conversations.family_member_id
    left join members as elder on elder.id = conversations.elder_member_id
    inner join family_spaces on family_spaces.id = conversations.family_space_id
    where conversations.family_space_id = ?
    order by conversations.last_meaningful_activity_at desc
  `).all(familySpaceId)
}

function canViewerAccessConversation(conversation, participants, viewer, memberId) {
  if (!conversation) {
    return false
  }

  if (viewer === 'elder') {
    return true
  }

  if (isAiConversation(conversation.conversationType)) {
    return false
  }

  if (!memberId) {
    return false
  }

  if (isGroupConversation(conversation.conversationType)) {
    return participants.some((participant) => participant.id === memberId)
  }

  return conversation.familyMemberId === memberId
}

function fetchConversationMessages(db, conversationId, viewerMemberId = null) {
  const messages = db.prepare(`
    select
      messages.id as id,
      messages.conversation_id as conversationId,
      messages.sender_type as senderType,
      messages.sender_member_id as senderMemberId,
      sender.display_name as senderDisplayName,
      sender.role as senderRole,
      messages.message_type as messageType,
      messages.text_content as textContent,
      messages.media_url as mediaUrl,
      messages.voice_duration_sec as voiceDurationSec,
      messages.transcript as transcript,
      messages.transcript_confidence as transcriptConfidence,
      messages.ai_drafted as aiDrafted,
      messages.status as status,
      messages.is_low_information as isLowInformation,
      messages.created_at as createdAt,
      messages.delivered_at as deliveredAt,
      messages.consumed_at as legacyConsumedAt,
      viewer_receipts.consumed_at as viewerConsumedAt,
      messages.recalled_at as recalledAt
    from messages
    left join members as sender on sender.id = messages.sender_member_id
    left join message_receipts as viewer_receipts
      on viewer_receipts.message_id = messages.id
      and viewer_receipts.member_id = ?
    where messages.conversation_id = ?
    order by messages.created_at asc
  `).all(viewerMemberId, conversationId).map(mapMessage)

  const emotionRows = db.prepare(`
    select
      source_message_id as sourceMessageId,
      severity,
      summary,
      emotion_source as source,
      emotion_label as label,
      emotion_mode as mode,
      source_excerpt as excerpt,
      created_at as createdAt
    from pulses
    where source_conversation_id = ?
      and pulse_type = 'Emotion'
      and source_message_id is not null
    order by created_at desc
  `).all(conversationId)

  const emotionByMessageId = new Map()
  for (const row of emotionRows) {
    if (!row.sourceMessageId || emotionByMessageId.has(row.sourceMessageId)) {
      continue
    }

    emotionByMessageId.set(row.sourceMessageId, {
      severity: row.severity,
      summary: row.summary,
      source: row.source ?? null,
      label: row.label ?? null,
      mode: row.mode ?? null,
      excerpt: row.excerpt ?? null,
      createdAt: row.createdAt,
    })
  }

  return messages.map((message) => ({
    ...message,
    emotion: emotionByMessageId.get(message.id) ?? null,
  }))
}

function buildConversationPayload(conversation, participants, messages, viewer, memberId) {
  const title = getConversationTitle(conversation)
  const unreadMessages = getUnreadMessagesForViewer(messages, conversation, viewer, memberId)

  return {
    id: conversation.conversationId,
    conversationType: conversation.conversationType ?? 'FAMILY_CHAT',
    memberId: conversation.familyMemberId ?? null,
    familyMemberId: conversation.familyMemberId ?? null,
    elderMemberId: conversation.elderMemberId ?? null,
    name: title,
    familyDisplayName: sanitizeText(conversation.familyDisplayName) ?? title,
    elderDisplayName: isGroupConversation(conversation.conversationType)
      ? title
      : sanitizeText(conversation.familySpaceElderDisplayName) || sanitizeText(conversation.elderDisplayName) || '长辈',
    avatar: getConversationAvatar(conversation),
    lastActivityAt: conversation.lastMeaningfulActivityAt ?? null,
    unreadCount: unreadMessages.length,
    unreadSummary: buildUnreadSummary(unreadMessages),
    primaryMessage: buildPrimaryMessage(messages.at(-1) ?? null, conversation.conversationType),
    participants,
    participantCount: participants.length,
    isGroup: isGroupConversation(conversation.conversationType),
    groupName: isGroupConversation(conversation.conversationType) ? title : null,
  }
}

function refreshMessageReadState(db, messageId) {
  const latestConsumedAt = db.prepare(`
    select max(consumed_at) as consumedAt
    from message_receipts
    where message_id = ?
  `).get(messageId)?.consumedAt ?? null

  const pendingCount = Number(db.prepare(`
    select count(*) as count
    from message_receipts
    where message_id = ?
      and consumed_at is null
  `).get(messageId)?.count ?? 0)

  db.prepare(`
    update messages
    set
      status = ?,
      consumed_at = ?
    where id = ?
  `).run(pendingCount === 0 ? 'READ' : 'DELIVERED', pendingCount === 0 ? latestConsumedAt : null, messageId)
}

function createReceiptsForMessage(db, messageId, participants, senderMemberId) {
  if (participants.length === 0) {
    return
  }

  const insertReceipt = db.prepare(`
    insert into message_receipts (id, message_id, member_id, consumed_at, created_at)
    values (?, ?, ?, null, ?)
  `)

  const now = Date.now()
  let created = false
  for (const participant of participants) {
    if (!participant?.id || participant.id === senderMemberId) {
      continue
    }

    insertReceipt.run(createEntityId('receipt'), messageId, participant.id, now)
    created = true
  }

  if (created) {
    refreshMessageReadState(db, messageId)
  }
}

export function listConversationCards(familySpaceId, viewer = 'elder', memberId = null) {
  const db = getDatabase()
  const conversations = fetchConversationRows(db, familySpaceId)
    .map((conversation) => {
      const participants = fetchConversationParticipants(db, conversation.conversationId)
      return {
        conversation,
        participants,
      }
    })
    .filter(({ conversation, participants }) => canViewerAccessConversation(conversation, participants, viewer, memberId))
    .sort((a, b) => {
      if (viewer === 'elder') {
        const aAi = isAiConversation(a.conversation.conversationType) ? 1 : 0
        const bAi = isAiConversation(b.conversation.conversationType) ? 1 : 0
        if (aAi !== bAi) return bAi - aAi
      }

      return Number(b.conversation.lastMeaningfulActivityAt ?? 0) - Number(a.conversation.lastMeaningfulActivityAt ?? 0)
    })

  return conversations.map(({ conversation, participants }) => {
    const messages = fetchConversationMessages(db, conversation.conversationId, getViewerMemberId(viewer, memberId, conversation))
    return buildConversationPayload(conversation, participants, messages, viewer, memberId)
  })
}

export function getConversationDetail(conversationId, familySpaceId, viewer = 'elder', memberId = null) {
  const db = getDatabase()
  ensureConversationSeeds(db, familySpaceId)

  const conversation = fetchConversationRow(db, conversationId, familySpaceId)
  if (!conversation) {
    return null
  }

  const participants = fetchConversationParticipants(db, conversationId)
  if (!canViewerAccessConversation(conversation, participants, viewer, memberId)) {
    return null
  }

  const messages = fetchConversationMessages(db, conversationId, getViewerMemberId(viewer, memberId, conversation))
  return {
    ...buildConversationPayload(conversation, participants, messages, viewer, memberId),
    messages,
  }
}

export function createMessage(conversationId, familySpaceId, payload, viewer = 'elder', memberId = null) {
  const db = getDatabase()
  ensureConversationSeeds(db, familySpaceId)

  const conversation = fetchConversationRow(db, conversationId, familySpaceId)
  if (!conversation) {
    return null
  }

  const participants = fetchConversationParticipants(db, conversationId)
  const now = Date.now()
  const messageId = createEntityId('msg')
  const senderMemberId = payload.senderMemberId ?? null
  const senderType = resolveSenderType(db, familySpaceId, senderMemberId, payload.senderType)

  db.prepare(`
    insert into messages (
      id, conversation_id, sender_type, sender_member_id, message_type,
      text_content, media_url, voice_duration_sec, transcript, transcript_confidence,
      ai_drafted, status, is_low_information, created_at, delivered_at, consumed_at, recalled_at
    ) values (
      $id, $conversationId, $senderType, $senderMemberId, $messageType,
      $textContent, $mediaUrl, $voiceDurationSec, $transcript, $transcriptConfidence,
      $aiDrafted, $status, $isLowInformation, $createdAt, $deliveredAt, $consumedAt, $recalledAt
    )
  `).run({
    id: messageId,
    conversationId,
    senderType,
    senderMemberId,
    messageType: payload.messageType,
    textContent: payload.textContent ?? null,
    mediaUrl: payload.mediaUrl ?? null,
    voiceDurationSec: payload.voiceDurationSec ?? null,
    transcript: payload.transcript ?? null,
    transcriptConfidence: payload.transcriptConfidence ?? null,
    aiDrafted: payload.aiDrafted ? 1 : 0,
    status: payload.status ?? 'DELIVERED',
    isLowInformation: payload.isLowInformation ? 1 : 0,
    createdAt: now,
    deliveredAt: now,
    consumedAt: null,
    recalledAt: null,
  })

  createReceiptsForMessage(db, messageId, participants, senderMemberId)

  db.prepare(`
    update conversations
    set last_meaningful_activity_at = ?
    where id = ?
  `).run(now, conversationId)

  return getConversationDetail(conversationId, familySpaceId, viewer, memberId)
}

export function markConversationUnreadAsRead(conversationId, familySpaceId, viewer = 'elder', memberId = null) {
  const db = getDatabase()
  ensureConversationSeeds(db, familySpaceId)

  const conversation = fetchConversationRow(db, conversationId, familySpaceId)
  if (!conversation) {
    return {
      updatedCount: 0,
      conversation: null,
    }
  }

  const viewerMemberId = getViewerMemberId(viewer, memberId, conversation)
  if (!viewerMemberId) {
    return {
      updatedCount: 0,
      conversation: getConversationDetail(conversationId, familySpaceId, viewer, memberId),
    }
  }

  const unreadMessageIds = db.prepare(`
    select message_receipts.message_id as messageId
    from message_receipts
    inner join messages on messages.id = message_receipts.message_id
    where messages.conversation_id = ?
      and message_receipts.member_id = ?
      and message_receipts.consumed_at is null
      and messages.recalled_at is null
  `).all(conversationId, viewerMemberId).map((row) => row.messageId)

  if (unreadMessageIds.length === 0) {
    return {
      updatedCount: 0,
      conversation: getConversationDetail(conversationId, familySpaceId, viewer, memberId),
    }
  }

  const now = Date.now()
  const result = db.prepare(`
    update message_receipts
    set consumed_at = ?
    where message_id in (
      select id
      from messages
      where conversation_id = ?
    )
      and member_id = ?
      and consumed_at is null
  `).run(now, conversationId, viewerMemberId)

  for (const messageId of unreadMessageIds) {
    refreshMessageReadState(db, messageId)
  }

  return {
    updatedCount: Number(result?.changes ?? 0),
    conversation: getConversationDetail(conversationId, familySpaceId, viewer, memberId),
  }
}
