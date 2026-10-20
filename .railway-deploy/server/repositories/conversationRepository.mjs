import { getDatabase } from '../db/index.mjs'
import { createEntityId } from '../services/auth/tokenService.mjs'

function looksGarbled(text) {
  if (typeof text !== 'string' || !text) return false
  if (text.includes('?')) return true
  const questionMarks = (text.match(/\?/g) || []).length
  const cjkChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  return questionMarks >= 3 && cjkChars === 0
}

function sanitizeText(text, fallback = '?????????????') {
  if (typeof text !== 'string' || !text) return text ?? null
  return looksGarbled(text) ? fallback : text
}

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderType: row.senderType,
    senderMemberId: row.senderMemberId,
    messageType: row.messageType,
    textContent: sanitizeText(row.textContent),
    mediaUrl: row.mediaUrl,
    voiceDurationSec: row.voiceDurationSec,
    transcript: row.transcript,
    transcriptConfidence: row.transcriptConfidence,
    aiDrafted: Boolean(row.aiDrafted),
    status: row.status,
    isLowInformation: Boolean(row.isLowInformation),
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt,
    consumedAt: row.consumedAt,
    recalledAt: row.recalledAt,
    emotion: row.emotion ?? null,
  }
}

function buildPrimaryMessage(message) {
  if (!message) {
    return null
  }

  if (message.messageType === 'Voice') {
    return {
      id: message.id,
      type: 'voice',
      preview: message.transcript ?? '发来一条语音',
      mediaLabel: null,
    }
  }

  if (message.messageType === 'Image') {
    return {
      id: message.id,
      type: 'image',
      preview: message.textContent ?? '发来一张图片',
      mediaLabel: '图片',
    }
  }

  if (message.messageType === 'Video') {
    return {
      id: message.id,
      type: 'video',
      preview: message.textContent ?? '发来一段视频',
      mediaLabel: '视频',
    }
  }

  return {
    id: message.id,
    type: 'text',
    preview: sanitizeText(message.textContent, '??????') ?? '',
    mediaLabel: message.mediaUrl,
  }
}

function buildUnreadSummary(messages) {
  const counts = { image: 0, voice: 0, video: 0, text: 0 }

  for (const message of messages) {
    const type = message.messageType.toLowerCase()
    if (type in counts) {
      counts[type] += 1
    }
  }

  const parts = []
  if (counts.image > 0) parts.push(`还有 ${counts.image} 张图片`)
  if (counts.video > 0) parts.push(`还有 ${counts.video} 条视频`)
  if (counts.voice > 0) parts.push(`还有 ${counts.voice} 条语音`)
  if (counts.text > 0) parts.push(`还有 ${counts.text} 条文字`)

  return parts.join('，') || '暂无未读'
}
function getPeerSenderType(viewer) {
  return viewer === 'family' ? 'Elder' : 'Family'
}

function getUnreadMessagesForViewer(messages, viewer) {
  const peerSenderType = getPeerSenderType(viewer)
  return messages.filter((message) => (
    message.senderType === peerSenderType
    && !message.consumedAt
    && !message.recalledAt
  ))
}

function ensureFamilyChatSeeds(db, familySpaceId) {
  if (!familySpaceId) {
    return
  }

  const elderRow = db.prepare(`
    select id
    from members
    where family_space_id = ?
      and role = 'Elder'
    limit 1
  `).get(familySpaceId)

  if (!elderRow?.id) {
    return
  }

  const familyMembers = db.prepare(`
    select id, last_activity_at as lastActivityAt
    from members
    where family_space_id = ?
      and role in ('Primary', 'Family', 'Trusted')
  `).all(familySpaceId)

  const existingConversationMemberIds = new Set(
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
    ) values (?, ?, ?, ?, 'FAMILY_CHAT', ?, ?)
  `)

  const now = Date.now()
  for (const member of familyMembers) {
    if (!member?.id || existingConversationMemberIds.has(member.id)) {
      continue
    }

    insertConversation.run(
      createEntityId('conv'),
      familySpaceId,
      elderRow.id,
      member.id,
      member.lastActivityAt ?? null,
      now,
    )
  }
}

function fetchConversationRows(db, familySpaceId) {
  ensureFamilyChatSeeds(db, familySpaceId)

  return db.prepare(`
    select
      conversations.id as conversationId,
      conversations.conversation_type as conversationType,
      conversations.last_meaningful_activity_at as lastMeaningfulActivityAt,
      members.id as memberId,
      conversations.family_member_id as familyMemberId,
      conversations.elder_member_id as elderMemberId,
      members.display_name as displayName,
      members.elder_alias as elderAlias,
      family_spaces.elder_display_name as elderDisplayName,
      substr(members.display_name, 1, 1) as avatar
    from conversations
    inner join members on members.id = conversations.family_member_id
    inner join family_spaces on family_spaces.id = conversations.family_space_id
    where conversations.family_space_id = ?
    order by conversations.last_meaningful_activity_at desc
  `).all(familySpaceId)
}

function fetchConversationMessages(db, conversationId) {
  const messages = db.prepare(`
    select
      id,
      conversation_id as conversationId,
      sender_type as senderType,
      sender_member_id as senderMemberId,
      message_type as messageType,
      text_content as textContent,
      media_url as mediaUrl,
      voice_duration_sec as voiceDurationSec,
      transcript,
      transcript_confidence as transcriptConfidence,
      ai_drafted as aiDrafted,
      status,
      is_low_information as isLowInformation,
      created_at as createdAt,
      delivered_at as deliveredAt,
      consumed_at as consumedAt,
      recalled_at as recalledAt
    from messages
    where conversation_id = ?
    order by created_at asc
  `).all(conversationId).map(mapMessage)

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

  for (const row of emotionRows) {
    if (row.sourceMessageId) {
      continue
    }

    const fallbackMessage = [...messages]
      .reverse()
      .find((message) => {
        if (message.senderType !== 'Elder') {
          return false
        }

        if (emotionByMessageId.has(message.id)) {
          return false
        }

        const ageDelta = Math.abs(Number(row.createdAt ?? 0) - Number(message.createdAt ?? 0))
        return ageDelta <= 2 * 60 * 1000
      })

    if (!fallbackMessage) {
      continue
    }

    emotionByMessageId.set(fallbackMessage.id, {
      severity: row.severity,
      summary: row.summary,
      source: row.source ?? null,
      label: row.label ?? null,
      mode: row.mode ?? 'fallback',
      excerpt: row.excerpt ?? fallbackMessage.textContent ?? fallbackMessage.transcript ?? null,
      createdAt: row.createdAt,
    })
  }

  return messages.map((message) => ({
    ...message,
    emotion: emotionByMessageId.get(message.id) ?? null,
  }))
}

export function listConversationCards(familySpaceId, viewer = 'elder') {
  const db = getDatabase()
  const conversations = fetchConversationRows(db, familySpaceId)
    .filter((conversation) => !(viewer === 'family' && conversation.conversationType === 'AI_ASSISTANT'))
    .sort((a, b) => {
      if (viewer === 'elder') {
        const aAi = a.conversationType === 'AI_ASSISTANT' ? 1 : 0
        const bAi = b.conversationType === 'AI_ASSISTANT' ? 1 : 0
        if (aAi !== bAi) return bAi - aAi
      }
      return Number(b.lastMeaningfulActivityAt ?? 0) - Number(a.lastMeaningfulActivityAt ?? 0)
    })

  return conversations.map((conversation) => {
    const messages = fetchConversationMessages(db, conversation.conversationId)
    const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null
    const unreadMessages = getUnreadMessagesForViewer(messages, viewer)

    return {
      id: conversation.conversationId,
      conversationType: conversation.conversationType ?? 'FAMILY_CHAT',
      memberId: conversation.memberId,
      familyMemberId: conversation.familyMemberId,
      elderMemberId: conversation.elderMemberId,
      name: conversation.elderAlias ?? conversation.displayName,
      familyDisplayName: conversation.displayName,
      elderDisplayName: conversation.elderDisplayName,
      avatar: conversation.avatar,
      lastActivityAt: conversation.lastMeaningfulActivityAt,
      unreadCount: unreadMessages.length,
      unreadSummary: buildUnreadSummary(unreadMessages),
      primaryMessage: buildPrimaryMessage(latestMessage),
    }
  })
}

export function getConversationDetail(conversationId, familySpaceId) {
  const db = getDatabase()
  const conversation = db.prepare(`
    select
      conversations.id as conversationId,
      conversations.conversation_type as conversationType,
      members.id as memberId,
      conversations.family_member_id as familyMemberId,
      conversations.elder_member_id as elderMemberId,
      members.display_name as displayName,
      members.elder_alias as elderAlias,
      family_spaces.elder_display_name as elderDisplayName,
      substr(members.display_name, 1, 1) as avatar
    from conversations
    inner join members on members.id = conversations.family_member_id
    inner join family_spaces on family_spaces.id = conversations.family_space_id
    where conversations.id = ?
      and conversations.family_space_id = ?
  `).get(conversationId, familySpaceId)

  if (!conversation) {
    return null
  }

  return {
    id: conversation.conversationId,
    conversationType: conversation.conversationType ?? 'FAMILY_CHAT',
    memberId: conversation.memberId,
    familyMemberId: conversation.familyMemberId,
    elderMemberId: conversation.elderMemberId,
    name: conversation.elderAlias ?? conversation.displayName,
    familyDisplayName: conversation.displayName,
    elderDisplayName: conversation.elderDisplayName,
    avatar: conversation.avatar,
    messages: fetchConversationMessages(db, conversationId),
  }
}

export function createMessage(conversationId, familySpaceId, payload) {
  const db = getDatabase()
  const now = Date.now()
  const id = `msg_${now}`

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
    id,
    conversationId,
    senderType: payload.senderType,
    senderMemberId: payload.senderMemberId ?? null,
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

  db.prepare(`
    update conversations
    set last_meaningful_activity_at = ?
    where id = ?
  `).run(now, conversationId)

  return getConversationDetail(conversationId, familySpaceId)
}

export function markConversationUnreadAsRead(conversationId, familySpaceId, viewer = 'elder') {
  const db = getDatabase()
  const peerSenderType = getPeerSenderType(viewer)
  const now = Date.now()

  const result = db.prepare(`
    update messages
    set
      consumed_at = ?,
      status = 'READ'
    where conversation_id = ?
      and sender_type = ?
      and consumed_at is null
      and recalled_at is null
  `).run(now, conversationId, peerSenderType)

  return {
    updatedCount: Number(result?.changes ?? 0),
    conversation: getConversationDetail(conversationId, familySpaceId),
  }
}
