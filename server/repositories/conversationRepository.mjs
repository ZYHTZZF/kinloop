import { getDatabase } from '../db/index.mjs'

function mapMessage(row) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderType: row.senderType,
    senderMemberId: row.senderMemberId,
    messageType: row.messageType,
    textContent: row.textContent,
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
  }
}

function buildUnreadSummary(messages) {
  const counts = { image: 0, voice: 0, text: 0 }

  for (const message of messages) {
    const type = message.messageType.toLowerCase()
    if (type in counts) {
      counts[type] += 1
    }
  }

  const parts = []
  if (counts.image > 0) parts.push(`还有 ${counts.image} 张照片`)
  if (counts.voice > 0) parts.push(`还有 ${counts.voice} 条语音`)
  if (counts.text > 0) parts.push(`还有 ${counts.text} 条文字`)

  return parts.join('、') || '暂无未读'
}

function selectPrimaryMessage(unreadMessages) {
  if (unreadMessages.length === 0) {
    return null
  }

  const sorted = [...unreadMessages].sort((left, right) => right.createdAt - left.createdAt)
  const candidate = sorted.find((message) => !message.isLowInformation) ?? sorted[0]

  if (!candidate) {
    return null
  }

  if (candidate.messageType === 'Voice') {
    return {
      id: candidate.id,
      type: 'voice',
      preview: candidate.transcript ?? '发来一段语音',
      mediaLabel: candidate.mediaUrl,
    }
  }

  if (candidate.messageType === 'Image') {
    return {
      id: candidate.id,
      type: 'image',
      preview: candidate.textContent ?? '发来一张照片',
      mediaLabel: candidate.mediaUrl,
    }
  }

  return {
    id: candidate.id,
    type: 'text',
    preview: candidate.textContent ?? '',
    mediaLabel: candidate.mediaUrl,
  }
}

export function listConversationCards() {
  const db = getDatabase()

  const conversations = db.prepare(`
    select
      conversations.id as conversationId,
      conversations.last_meaningful_activity_at as lastMeaningfulActivityAt,
      members.id as memberId,
      members.display_name as displayName,
      members.elder_alias as elderAlias,
      family_spaces.elder_display_name as elderDisplayName,
      substr(members.display_name, 1, 1) as avatar
    from conversations
    inner join members on members.id = conversations.family_member_id
    inner join family_spaces on family_spaces.id = conversations.family_space_id
    order by conversations.last_meaningful_activity_at desc
  `).all()

  const statement = db.prepare(`
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
    where conversation_id = ? and sender_type = 'Family' and status in ('DELIVERED', 'SENT')
  `)

  return conversations.map((conversation) => {
    const unreadMessages = statement.all(conversation.conversationId).map(mapMessage)
    const primaryMessage = selectPrimaryMessage(unreadMessages)

    return {
      id: conversation.conversationId,
      memberId: conversation.memberId,
      name: conversation.elderAlias ?? conversation.displayName,
      familyDisplayName: conversation.displayName,
      elderDisplayName: conversation.elderDisplayName,
      avatar: conversation.avatar,
      lastActivityAt: conversation.lastMeaningfulActivityAt,
      unreadCount: unreadMessages.length,
      unreadSummary: buildUnreadSummary(
        unreadMessages.filter((message) => (primaryMessage ? message.id !== primaryMessage.id : true)),
      ),
      primaryMessage,
    }
  })
}

export function getConversationDetail(conversationId) {
  const db = getDatabase()

  const conversation = db.prepare(`
    select
      conversations.id as conversationId,
      members.id as memberId,
      members.display_name as displayName,
      members.elder_alias as elderAlias,
      family_spaces.elder_display_name as elderDisplayName,
      substr(members.display_name, 1, 1) as avatar
    from conversations
    inner join members on members.id = conversations.family_member_id
    inner join family_spaces on family_spaces.id = conversations.family_space_id
    where conversations.id = ?
  `).get(conversationId)

  if (!conversation) {
    return null
  }

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

  return {
    id: conversation.conversationId,
    memberId: conversation.memberId,
    name: conversation.elderAlias ?? conversation.displayName,
    familyDisplayName: conversation.displayName,
    elderDisplayName: conversation.elderDisplayName,
    avatar: conversation.avatar,
    messages,
  }
}

export function createMessage(conversationId, payload) {
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

  return getConversationDetail(conversationId)
}
