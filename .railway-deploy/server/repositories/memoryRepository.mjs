import { getDatabase } from '../db/index.mjs'

export function listMemories(familySpaceId) {
  const db = getDatabase()
  return db.prepare(`
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
    order by added_at desc
  `).all(familySpaceId)
}

export function createMemoryEntry(payload, familySpaceId) {
  const db = getDatabase()
  const now = Date.now()
  const id = `memory_${now}`

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
    sourceConvId: payload.sourceConvId ?? null,
    sourceMsgId: payload.sourceMsgId ?? null,
    addedByMemberId: payload.addedByMemberId,
    addedAt: now,
    memoryType: payload.memoryType,
    title: payload.title ?? null,
    description: payload.description ?? null,
    mediaUrl: payload.mediaUrl ?? null,
    status: payload.status ?? 'ACTIVE',
    visibleScope: payload.visibleScope ?? 'FamilySpaceDefault',
    createdAt: now,
    updatedAt: now,
  })

  return db.prepare(`
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
}
