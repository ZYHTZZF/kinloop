import { getDatabase } from '../db/index.mjs'

function listHeartPostRows(db, familySpaceId) {
  return db.prepare(`
    select
      hp.id,
      hp.family_space_id as familySpaceId,
      hp.author_member_id as authorMemberId,
      hp.content,
      hp.image_url as imageUrl,
      hp.status,
      hp.created_at as createdAt,
      hp.updated_at as updatedAt,
      m.display_name as authorDisplayName,
      m.role as authorRole,
      m.relation_label as authorRelationLabel
    from heart_posts hp
    join members m on m.id = hp.author_member_id
    where hp.family_space_id = ?
    order by hp.created_at desc
  `).all(familySpaceId)
}

function getHeartPostRow(db, heartPostId, familySpaceId) {
  return db.prepare(`
    select
      hp.id,
      hp.family_space_id as familySpaceId,
      hp.author_member_id as authorMemberId,
      hp.content,
      hp.image_url as imageUrl,
      hp.status,
      hp.created_at as createdAt,
      hp.updated_at as updatedAt,
      m.display_name as authorDisplayName,
      m.role as authorRole,
      m.relation_label as authorRelationLabel
    from heart_posts hp
    join members m on m.id = hp.author_member_id
    where hp.id = ?
      and hp.family_space_id = ?
    limit 1
  `).get(heartPostId, familySpaceId)
}

function hydrateHeartPosts(db, rows, viewerMemberId) {
  if (rows.length === 0) {
    return []
  }

  const postIds = rows.map((row) => row.id)
  const placeholders = postIds.map(() => '?').join(', ')

  const likeRows = db.prepare(`
    select
      heart_post_id as heartPostId,
      member_id as memberId
    from heart_post_likes
    where heart_post_id in (${placeholders})
  `).all(...postIds)

  const commentRows = db.prepare(`
    select
      c.id,
      c.heart_post_id as heartPostId,
      c.member_id as authorMemberId,
      c.content,
      c.status,
      c.created_at as createdAt,
      c.updated_at as updatedAt,
      m.display_name as authorDisplayName,
      m.role as authorRole,
      m.relation_label as authorRelationLabel
    from heart_post_comments c
    join members m on m.id = c.member_id
    where c.heart_post_id in (${placeholders})
      and c.status = 'ACTIVE'
    order by c.created_at asc
  `).all(...postIds)

  const likesByPostId = new Map()
  for (const likeRow of likeRows) {
    const currentLikes = likesByPostId.get(likeRow.heartPostId) ?? []
    currentLikes.push(likeRow.memberId)
    likesByPostId.set(likeRow.heartPostId, currentLikes)
  }

  const commentsByPostId = new Map()
  for (const commentRow of commentRows) {
    const currentComments = commentsByPostId.get(commentRow.heartPostId) ?? []
    currentComments.push(commentRow)
    commentsByPostId.set(commentRow.heartPostId, currentComments)
  }

  return rows.map((row) => {
    const likes = likesByPostId.get(row.id) ?? []
    return {
      ...row,
      content: row.content ?? '',
      imageUrl: row.imageUrl ?? null,
      likeCount: likes.length,
      likedByViewer: viewerMemberId ? likes.includes(viewerMemberId) : false,
      comments: commentsByPostId.get(row.id) ?? [],
    }
  })
}

export function listHeartPosts(familySpaceId, viewerMemberId = null) {
  const db = getDatabase()
  return hydrateHeartPosts(db, listHeartPostRows(db, familySpaceId), viewerMemberId)
}

export function getHeartPostById(heartPostId, familySpaceId, viewerMemberId = null) {
  const db = getDatabase()
  const row = getHeartPostRow(db, heartPostId, familySpaceId)
  if (!row) {
    return null
  }

  return hydrateHeartPosts(db, [row], viewerMemberId)[0] ?? null
}

export function createHeartPost(payload, familySpaceId, authorMemberId, viewerMemberId = authorMemberId) {
  const content = `${payload?.content ?? ''}`.trim()
  const imageUrl = `${payload?.imageUrl ?? ''}`.trim() || null

  if (!content && !imageUrl) {
    throw new Error('至少要写点内容，或者发一张照片。')
  }

  if (content.length > 280) {
    throw new Error('心语内容请控制在 280 字以内。')
  }

  const db = getDatabase()
  const now = Date.now()
  const id = `heart_${now}_${Math.random().toString(36).slice(2, 8)}`

  db.prepare(`
    insert into heart_posts (
      id,
      family_space_id,
      author_member_id,
      content,
      image_url,
      status,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, familySpaceId, authorMemberId, content, imageUrl, 'ACTIVE', now, now)

  return getHeartPostById(id, familySpaceId, viewerMemberId)
}

export function toggleHeartPostLike(heartPostId, familySpaceId, memberId) {
  const db = getDatabase()
  const post = getHeartPostRow(db, heartPostId, familySpaceId)
  if (!post) {
    throw new Error('这条心语不存在。')
  }

  const existingLike = db.prepare(`
    select id
    from heart_post_likes
    where heart_post_id = ?
      and member_id = ?
    limit 1
  `).get(heartPostId, memberId)

  if (existingLike) {
    db.prepare('delete from heart_post_likes where id = ?').run(existingLike.id)
  } else {
    db.prepare(`
      insert into heart_post_likes (
        id,
        heart_post_id,
        member_id,
        created_at
      ) values (?, ?, ?, ?)
    `).run(`heart_like_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, heartPostId, memberId, Date.now())
  }

  return getHeartPostById(heartPostId, familySpaceId, memberId)
}

export function createHeartPostComment(heartPostId, payload, familySpaceId, memberId) {
  const db = getDatabase()
  const post = getHeartPostRow(db, heartPostId, familySpaceId)
  if (!post) {
    throw new Error('这条心语不存在。')
  }

  const content = `${payload?.content ?? ''}`.trim()
  if (!content) {
    throw new Error('评论内容不能为空。')
  }

  if (content.length > 180) {
    throw new Error('评论请控制在 180 字以内。')
  }

  const now = Date.now()
  db.prepare(`
    insert into heart_post_comments (
      id,
      heart_post_id,
      member_id,
      content,
      status,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?)
  `).run(`heart_comment_${now}_${Math.random().toString(36).slice(2, 8)}`, heartPostId, memberId, content, 'ACTIVE', now, now)

  return getHeartPostById(heartPostId, familySpaceId, memberId)
}
