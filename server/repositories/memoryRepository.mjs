import { getDatabase } from '../db/index.mjs'

function runInTransaction(work) {
  const db = getDatabase()
  db.exec('begin')

  try {
    const result = work()
    db.exec('commit')
    return result
  } catch (error) {
    try {
      db.exec('rollback')
    } catch {
      // Keep the original error visible to callers.
    }
    throw error
  }
}

function mapMemoryRow(row, items = []) {
  return {
    id: row.id,
    familySpaceId: row.familySpaceId,
    sourceConvId: row.sourceConvId,
    sourceMsgId: row.sourceMsgId,
    addedByMemberId: row.addedByMemberId,
    addedAt: row.addedAt,
    memoryType: row.memoryType,
    title: row.title,
    description: row.description,
    mediaUrl: row.mediaUrl,
    status: row.status,
    visibleScope: row.visibleScope,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items,
  }
}

function listMemoryItems(memoryEntryIds) {
  if (memoryEntryIds.length === 0) {
    return new Map()
  }

  const db = getDatabase()
  const placeholders = memoryEntryIds.map(() => '?').join(',')
  const rows = db.prepare(`
    select
      id,
      memory_entry_id as memoryEntryId,
      source_conv_id as sourceConvId,
      source_msg_id as sourceMsgId,
      sender_member_id as senderMemberId,
      sender_display_name as senderDisplayName,
      sender_role as senderRole,
      message_type as messageType,
      text_content as textContent,
      transcript,
      media_url as mediaUrl,
      voice_duration_sec as voiceDurationSec,
      sent_at as sentAt,
      sort_order as sortOrder,
      created_at as createdAt
    from memory_items
    where memory_entry_id in (${placeholders})
    order by memory_entry_id asc, sort_order asc, sent_at asc
  `).all(...memoryEntryIds)

  const itemsByMemoryId = new Map()
  for (const row of rows) {
    const items = itemsByMemoryId.get(row.memoryEntryId) ?? []
    items.push(row)
    itemsByMemoryId.set(row.memoryEntryId, items)
  }

  return itemsByMemoryId
}

export function listMemories(familySpaceId) {
  const db = getDatabase()
  const memories = db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      source_conv_id as sourceConvId,
      source_msg_id as sourceMsgId,
      added_by_member_id as addedByMemberId,
      added_at as addedAt,
      memory_type as memoryType,
      title,
      description,
      media_url as mediaUrl,
      status,
      visible_scope as visibleScope,
      created_at as createdAt,
      updated_at as updatedAt
    from memory_entries
    where family_space_id = ?
      and status = 'ACTIVE'
    order by added_at desc
  `).all(familySpaceId)

  const itemsByMemoryId = listMemoryItems(memories.map((memory) => memory.id))
  return memories.map((memory) => mapMemoryRow(memory, itemsByMemoryId.get(memory.id) ?? []))
}

export function createMemoryEntry(payload, familySpaceId) {
  const db = getDatabase()
  const now = Date.now()
  const id = `memory_${now}`
  const incomingItems = Array.isArray(payload.items) ? payload.items : []
  const normalizedItems = incomingItems.length > 0
    ? incomingItems
    : [{
        sourceConvId: payload.sourceConvId ?? null,
        sourceMsgId: payload.sourceMsgId ?? null,
        senderMemberId: payload.senderMemberId ?? null,
        senderDisplayName: payload.senderDisplayName ?? null,
        senderRole: payload.senderRole ?? null,
        messageType: payload.memoryType ?? 'Text',
        textContent: payload.description ?? null,
        transcript: payload.transcript ?? null,
        mediaUrl: payload.mediaUrl ?? null,
        voiceDurationSec: payload.voiceDurationSec ?? null,
        sentAt: payload.sentAt ?? payload.addedAt ?? now,
      }]

  runInTransaction(() => {
    db.prepare(`
      insert into memory_entries (
        id, family_space_id, source_conv_id, source_msg_id, added_by_member_id,
        added_at, memory_type, title, description, media_url, status,
        visible_scope, created_at, updated_at
      ) values (
        $id, $familySpaceId, $sourceConvId, $sourceMsgId, $addedByMemberId,
        $addedAt, $memoryType, $title, $description, $mediaUrl, $status,
        $visibleScope, $createdAt, $updatedAt
      )
    `).run({
      id,
      familySpaceId,
      sourceConvId: payload.sourceConvId ?? normalizedItems[0]?.sourceConvId ?? null,
      sourceMsgId: payload.sourceMsgId ?? (normalizedItems.length === 1 ? normalizedItems[0]?.sourceMsgId ?? null : null),
      addedByMemberId: payload.addedByMemberId,
      addedAt: now,
      memoryType: payload.memoryType ?? (normalizedItems.length > 1 ? 'Mixed' : normalizedItems[0]?.messageType ?? 'Text'),
      title: payload.title ?? null,
      description: payload.description ?? null,
      mediaUrl: payload.mediaUrl ?? (normalizedItems.length === 1 ? normalizedItems[0]?.mediaUrl ?? null : null),
      status: payload.status ?? 'ACTIVE',
      visibleScope: payload.visibleScope ?? 'FamilySpaceDefault',
      createdAt: now,
      updatedAt: now,
    })

    const insertItem = db.prepare(`
      insert into memory_items (
        id, memory_entry_id, source_conv_id, source_msg_id, sender_member_id,
        sender_display_name, sender_role, message_type, text_content, transcript,
        media_url, voice_duration_sec, sent_at, sort_order, created_at
      ) values (
        $id, $memoryEntryId, $sourceConvId, $sourceMsgId, $senderMemberId,
        $senderDisplayName, $senderRole, $messageType, $textContent, $transcript,
        $mediaUrl, $voiceDurationSec, $sentAt, $sortOrder, $createdAt
      )
    `)

    normalizedItems.forEach((item, index) => {
      insertItem.run({
        id: `${id}_item_${index + 1}`,
        memoryEntryId: id,
        sourceConvId: item.sourceConvId ?? payload.sourceConvId ?? null,
        sourceMsgId: item.sourceMsgId ?? null,
        senderMemberId: item.senderMemberId ?? null,
        senderDisplayName: item.senderDisplayName ?? null,
        senderRole: item.senderRole ?? null,
        messageType: item.messageType ?? 'Text',
        textContent: item.textContent ?? null,
        transcript: item.transcript ?? null,
        mediaUrl: item.mediaUrl ?? null,
        voiceDurationSec: item.voiceDurationSec ?? null,
        sentAt: item.sentAt ?? now,
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
        createdAt: now,
      })
    })
  })

  const memory = db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      source_conv_id as sourceConvId,
      source_msg_id as sourceMsgId,
      added_by_member_id as addedByMemberId,
      added_at as addedAt,
      memory_type as memoryType,
      title,
      description,
      media_url as mediaUrl,
      status,
      visible_scope as visibleScope,
      created_at as createdAt,
      updated_at as updatedAt
    from memory_entries
    where id = ?
  `).get(id)

  const itemsByMemoryId = listMemoryItems([id])
  return mapMemoryRow(memory, itemsByMemoryId.get(id) ?? [])
}

export function removeMemoryEntry(memoryId, familySpaceId) {
  const db = getDatabase()
  const now = Date.now()
  const result = db.prepare(`
    update memory_entries
    set
      status = 'REMOVED',
      updated_at = ?
    where id = ?
      and family_space_id = ?
      and status = 'ACTIVE'
  `).run(now, memoryId, familySpaceId)

  return Number(result?.changes ?? 0) > 0
}
