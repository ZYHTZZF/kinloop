import { getDatabase } from '../db/index.mjs'
import { AUTH_CODE_TTL_MS, AUTH_SESSION_TTL_MS } from '../config.mjs'
import { createPasswordHash, verifyPassword } from '../services/auth/passwordService.mjs'
import {
  createEntityId,
  createFamilyJoinCode,
  createOneTimeCode,
  createOpaqueToken,
  hashOpaqueToken,
} from '../services/auth/tokenService.mjs'

const ELDER_INVITE_EXPIRES_AT = Date.UTC(2100, 0, 1)

function mapUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function normalizeAppRole(memberRole) {
  if (memberRole === 'Elder') return 'elder'
  if (memberRole === 'Trusted') return 'caregiver'
  return 'family'
}

function mapMembership(row) {
  if (!row) return null
  return {
    memberId: row.memberId,
    familySpaceId: row.familySpaceId,
    familyName: row.familyName,
    familyJoinCode: row.familyJoinCode,
    familyElderDisplayName: row.familyElderDisplayName,
    role: normalizeAppRole(row.memberRole),
    memberRole: row.memberRole,
    memberDisplayName: row.memberDisplayName,
    relationLabel: row.relationLabel ?? null,
    primaryMemberId: row.primaryMemberId,
  }
}

function getUserById(userId) {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      email,
      email_verified_at as emailVerifiedAt,
      created_at as createdAt,
      updated_at as updatedAt
    from users
    where id = ?
    limit 1
  `).get(userId)
}

function buildSessionPayload(user, membership, token) {
  return {
    token,
    user,
    membership,
    homePath: membership?.role === 'elder' ? '/elder/home' : membership?.role === 'caregiver' ? '/family/collaboration' : '/family/today',
  }
}

function toMemberRole(role) {
  if (role === 'elder') return 'Elder'
  if (role === 'caregiver') return 'Trusted'
  return 'Primary'
}

function normalizeInviteRequestedRole(role) {
  const requestedRole = `${role ?? ''}`.trim()
  if (requestedRole === 'Elder') return 'Elder'
  if (requestedRole === 'Trusted') return 'Trusted'
  return 'Family'
}

function ensureAiAssistantSeedForFamily(familySpaceId) {
  const db = getDatabase()
  const aiMemberId = `member_ai_${familySpaceId}`
  const aiConversationId = `conv_ai_${familySpaceId}`
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

  const now = Date.now()
  const existingAiMember = db.prepare('select id from members where id = ? limit 1').get(aiMemberId)
  if (!existingAiMember) {
    db.prepare(`
      insert into members (
        id, family_space_id, user_id, role, display_name, relation_label, elder_alias, phone, last_activity_at, alert_priority, status
      ) values (?, ?, null, 'AI', 'AI助手', 'AI 助理', 'AI助手', null, ?, null, 'Active')
    `).run(aiMemberId, familySpaceId, now)
  }

  const existingAiConversation = db.prepare('select id from conversations where id = ? limit 1').get(aiConversationId)
  if (!existingAiConversation) {
    db.prepare(`
      insert into conversations (
        id, family_space_id, elder_member_id, family_member_id, conversation_type, last_meaningful_activity_at, created_at
      ) values (?, ?, ?, ?, 'AI_ASSISTANT', ?, ?)
    `).run(aiConversationId, familySpaceId, elderRow.id, aiMemberId, now, now)

    db.prepare(`
      insert into messages (
        id, conversation_id, sender_type, sender_member_id, message_type, text_content, media_url, voice_duration_sec,
        transcript, transcript_confidence, ai_drafted, status, is_low_information, created_at, delivered_at, consumed_at, recalled_at
      ) values (?, ?, 'System', ?, 'Text', ?, null, null, null, null, 0, 'DELIVERED', 0, ?, ?, ?, null)
    `).run(
      createEntityId('msg'),
      aiConversationId,
      aiMemberId,
      '你好，我是 Kinloop 的 AI 助手，需要时可以帮你联系家人、整理消息或辅助理解内容。',
      now,
      now,
      now,
    )
  }
}

function getMembershipForUser(userId) {
  const db = getDatabase()
  const row = db.prepare(`
    select
      members.id as memberId,
      members.family_space_id as familySpaceId,
      members.role as memberRole,
      members.display_name as memberDisplayName,
      members.relation_label as relationLabel,
      family_spaces.name as familyName,
      family_spaces.join_code as familyJoinCode,
      family_spaces.elder_display_name as familyElderDisplayName,
      family_spaces.primary_member_id as primaryMemberId
    from members
    inner join family_spaces on family_spaces.id = members.family_space_id
    where members.user_id = ?
    order by
      case members.role
        when 'Elder' then 1
        when 'Primary' then 2
        when 'Family' then 3
        when 'Trusted' then 4
        else 5
      end
    limit 1
  `).get(userId)
  return mapMembership(row)
}

export function getMembershipForUserId(userId) {
  return getMembershipForUser(userId)
}

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
      // Ignore rollback failures and surface the original error.
    }
    throw error
  }
}

function createSessionForUser(userId, membership = null) {
  const db = getDatabase()
  const token = createOpaqueToken()
  const now = Date.now()
  db.prepare(`
    insert into auth_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at)
    values (?, ?, ?, ?, ?, ?)
  `).run(createEntityId('session'), userId, hashOpaqueToken(token), now + AUTH_SESSION_TTL_MS, now, now)

  const user = mapUser(getUserById(userId))
  return buildSessionPayload(user, membership ?? getMembershipForUser(userId), token)
}

export function findUserByEmail(email) {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      email,
      password_hash as passwordHash,
      password_salt as passwordSalt,
      email_verified_at as emailVerifiedAt,
      created_at as createdAt,
      updated_at as updatedAt
    from users
    where lower(email) = lower(?)
    limit 1
  `).get(email)
}

export function createAuthCode(email, purpose) {
  const db = getDatabase()
  const now = Date.now()
  const code = createOneTimeCode()

  db.prepare(`
    update auth_codes
    set consumed_at = ?
    where email = ?
      and purpose = ?
      and consumed_at is null
  `).run(now, email, purpose)

  db.prepare(`
    insert into auth_codes (id, email, purpose, code, expires_at, consumed_at, created_at)
    values (?, ?, ?, ?, ?, null, ?)
  `).run(createEntityId('code'), email, purpose, code, now + AUTH_CODE_TTL_MS, now)

  return { email, purpose, code, expiresAt: now + AUTH_CODE_TTL_MS }
}

export function consumeAuthCode(email, purpose, code) {
  const db = getDatabase()
  const now = Date.now()
  const row = db.prepare(`
    select id, expires_at as expiresAt
    from auth_codes
    where email = ?
      and purpose = ?
      and code = ?
      and consumed_at is null
    order by created_at desc
    limit 1
  `).get(email, purpose, code)

  if (!row) {
    throw new Error('验证码不正确。')
  }
  if (Number(row.expiresAt) < now) {
    throw new Error('验证码已过期，请重新获取。')
  }

  db.prepare('update auth_codes set consumed_at = ? where id = ?').run(now, row.id)
}

function createFamilyForUser({ userId, role, familyName, displayName, relationLabel }) {
  const db = getDatabase()
  const now = Date.now()
  const familySpaceId = createEntityId('family')
  const memberId = createEntityId('member')
  const memberRole = toMemberRole(role)
  const safeDisplayName = (displayName ?? '').trim() || (role === 'elder' ? '长辈' : '家人')

  db.prepare(`
    insert into family_spaces (
      id, name, join_code, elder_display_name, primary_member_id, created_by_user_id, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    familySpaceId,
    (familyName ?? '').trim() || `${safeDisplayName}的家庭`,
    createFamilyJoinCode(),
    role === 'elder' ? safeDisplayName : '待绑定长辈',
    memberId,
    userId,
    now,
    now,
  )

  db.prepare(`
    insert into members (
      id, family_space_id, user_id, role, display_name, relation_label, elder_alias, phone, last_activity_at, alert_priority, status
    ) values (?, ?, ?, ?, ?, ?, ?, null, ?, ?, 'Active')
  `).run(
    memberId,
    familySpaceId,
    userId,
    memberRole,
    safeDisplayName,
    relationLabel ?? null,
    safeDisplayName,
    now,
    memberRole === 'Primary' ? 1 : memberRole === 'Family' ? 2 : null,
  )

  ensureAiAssistantSeedForFamily(familySpaceId)
  return getMembershipForUser(userId)
}

function joinFamilyForUser({ userId, role, familyCode, displayName, relationLabel }) {
  const db = getDatabase()
  const now = Date.now()
  const normalizedFamilyCode = `${familyCode ?? ''}`.trim().toUpperCase()
  if (!normalizedFamilyCode) {
    throw new Error('请输入家庭邀请码。')
  }

  const familySpace = db.prepare(`
    select id
    from family_spaces
    where join_code = ?
    limit 1
  `).get(normalizedFamilyCode)

  if (!familySpace) {
    throw new Error('家庭邀请码无效或已过期。')
  }

  const existingMembership = db.prepare(`
    select id
    from members
    where family_space_id = ?
      and user_id = ?
    limit 1
  `).get(familySpace.id, userId)
  if (existingMembership) {
    throw new Error('您已经加入该家庭。')
  }

  if (role === 'elder') {
    const elderExists = db.prepare(`
      select id
      from members
      where family_space_id = ?
        and role = 'Elder'
      limit 1
    `).get(familySpace.id)
    if (elderExists) {
      throw new Error('该家庭已绑定长辈账号。')
    }
  }

  const memberRole = toMemberRole(role)
  const memberId = createEntityId('member')
  const safeDisplayName = (displayName ?? '').trim() || (role === 'elder' ? '长辈' : '家人')
  db.prepare(`
    insert into members (
      id, family_space_id, user_id, role, display_name, relation_label, elder_alias, phone, last_activity_at, alert_priority, status
    ) values (?, ?, ?, ?, ?, ?, ?, null, ?, ?, 'Active')
  `).run(
    memberId,
    familySpace.id,
    userId,
    memberRole,
    safeDisplayName,
    relationLabel ?? null,
    safeDisplayName,
    now,
    memberRole === 'Primary' ? 1 : memberRole === 'Family' ? 2 : null,
  )

  if (role === 'elder') {
    db.prepare(`
      update family_spaces
      set elder_display_name = ?, updated_at = ?
      where id = ?
    `).run(safeDisplayName, now, familySpace.id)
  }

  ensureAiAssistantSeedForFamily(familySpace.id)
  return getMembershipForUser(userId)
}

export function createRegisteredUser({ email, password, role, familyAction, familyName, familyCode, displayName, relationLabel }) {
  const db = getDatabase()
  const normalizedEmail = email.trim().toLowerCase()
  const existingUser = findUserByEmail(normalizedEmail)

  if (existingUser) {
    const existingMembership = getMembershipForUser(existingUser.id)
    if (existingMembership) {
      throw new Error('该邮箱已注册，请直接登录。')
    }

    const membership = runInTransaction(() => {
      const now = Date.now()
      const { hash, salt } = createPasswordHash(password)

      db.prepare(`
        update users
        set password_hash = ?, password_salt = ?, email_verified_at = coalesce(email_verified_at, ?), updated_at = ?
        where id = ?
      `).run(hash, salt, now, now, existingUser.id)

      return familyAction === 'join'
        ? joinFamilyForUser({ userId: existingUser.id, role, familyCode, displayName, relationLabel })
        : createFamilyForUser({ userId: existingUser.id, role, familyName, displayName, relationLabel })
    })
    return createSessionForUser(existingUser.id, membership)
  }

  const createdUser = runInTransaction(() => {
    const now = Date.now()
    const userId = createEntityId('user')
    const { hash, salt } = createPasswordHash(password)

    db.prepare(`
      insert into users (id, email, password_hash, password_salt, email_verified_at, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, hash, salt, now, now, now)

    const membership = familyAction === 'join'
      ? joinFamilyForUser({ userId, role, familyCode, displayName, relationLabel })
      : createFamilyForUser({ userId, role, familyName, displayName, relationLabel })

    return { userId, membership }
  })
  return createSessionForUser(createdUser.userId, createdUser.membership)
}

export function loginUser({ email, password }) {
  const user = findUserByEmail(email.trim().toLowerCase())
  if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    throw new Error('邮箱或密码不正确。')
  }

  const membership = getMembershipForUser(user.id)
  if (!membership) {
    throw new Error('账号已注册但还没绑定家庭，请回到注册页，用同一邮箱继续完成家庭绑定。')
  }

  return createSessionForUser(user.id, membership)
}

export function resetUserPassword({ email, newPassword }) {
  const db = getDatabase()
  const user = findUserByEmail(email.trim().toLowerCase())
  if (!user) {
    throw new Error('该邮箱尚未注册。')
  }

  const now = Date.now()
  const { hash, salt } = createPasswordHash(newPassword)
  db.prepare(`
    update users
    set password_hash = ?, password_salt = ?, email_verified_at = coalesce(email_verified_at, ?), updated_at = ?
    where id = ?
  `).run(hash, salt, now, now, user.id)

  return createSessionForUser(user.id, getMembershipForUser(user.id))
}

export function getSessionByToken(token) {
  const db = getDatabase()
  const now = Date.now()
  const row = db.prepare(`
    select
      auth_sessions.id as sessionId,
      auth_sessions.user_id as userId
    from auth_sessions
    where token_hash = ?
    limit 1
  `).get(hashOpaqueToken(token))

  if (!row) return null

  const expiry = db.prepare('select expires_at as expiresAt from auth_sessions where id = ?').get(row.sessionId)
  if (Number(expiry?.expiresAt ?? 0) < now) {
    db.prepare('delete from auth_sessions where id = ?').run(row.sessionId)
    return null
  }

  db.prepare('update auth_sessions set last_seen_at = ? where id = ?').run(now, row.sessionId)

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    user: mapUser(getUserById(row.userId)),
    membership: getMembershipForUser(row.userId),
  }
}

export function getCurrentSessionPayload(token) {
  const session = getSessionByToken(token)
  if (!session) return null
  return buildSessionPayload(session.user, session.membership, token)
}

export function deleteSession(token) {
  const db = getDatabase()
  db.prepare('delete from auth_sessions where token_hash = ?').run(hashOpaqueToken(token))
}

function getInviteCodeById(inviteId) {
  const db = getDatabase()
  return db.prepare(`
    select
      invite_codes.id,
      invite_codes.family_space_id as familySpaceId,
      invite_codes.code,
      invite_codes.status,
      invite_codes.requested_role as requestedRole,
      invite_codes.target_member_id as targetMemberId,
      members.display_name as targetDisplayName,
      invite_codes.created_by_member_id as createdByMemberId,
      invite_codes.approved_member_id as approvedMemberId,
      invite_codes.expires_at as expiresAt,
      invite_codes.created_at as createdAt,
      invite_codes.approved_at as approvedAt
    from invite_codes
    left join members on members.id = invite_codes.target_member_id
    where invite_codes.id = ?
  `).get(inviteId)
}

function getElderMemberById(memberId) {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      user_id as userId,
      display_name as displayName
    from members
    where id = ?
      and role = 'Elder'
    limit 1
  `).get(memberId)
}

function getFirstElderMember(familySpaceId) {
  const db = getDatabase()
  return db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      user_id as userId,
      display_name as displayName
    from members
    where family_space_id = ?
      and role = 'Elder'
    order by
      case when user_id is not null then 1 else 2 end,
      id asc
    limit 1
  `).get(familySpaceId)
}

function resolveElderDisplayName(familySpaceId, displayName) {
  const db = getDatabase()
  const safeDisplayName = `${displayName ?? ''}`.trim()
  if (safeDisplayName) return safeDisplayName

  const familySpace = db.prepare(`
    select elder_display_name as elderDisplayName
    from family_spaces
    where id = ?
    limit 1
  `).get(familySpaceId)

  const currentName = `${familySpace?.elderDisplayName ?? ''}`.trim()
  return currentName && currentName !== '待绑定长辈' ? currentName : '长辈'
}

function ensureElderMemberForFamily({ familySpaceId, displayName }) {
  const db = getDatabase()
  const now = Date.now()
  const safeDisplayName = resolveElderDisplayName(familySpaceId, displayName)
  const existingElder = getFirstElderMember(familySpaceId)

  if (existingElder?.id) {
    db.prepare(`
      update members
      set display_name = ?, elder_alias = ?
      where id = ?
    `).run(safeDisplayName, safeDisplayName, existingElder.id)

    db.prepare(`
      update family_spaces
      set elder_display_name = ?, updated_at = ?
      where id = ?
    `).run(safeDisplayName, now, familySpaceId)

    return existingElder.id
  }

  const memberId = createEntityId('member')
  db.prepare(`
    insert into members (
      id, family_space_id, user_id, role, display_name, relation_label, elder_alias, phone, last_activity_at, alert_priority, status
    ) values (?, ?, null, 'Elder', ?, '长辈', ?, null, null, null, 'Active')
  `).run(memberId, familySpaceId, safeDisplayName, safeDisplayName)

  db.prepare(`
    update family_spaces
    set elder_display_name = ?, updated_at = ?
    where id = ?
  `).run(safeDisplayName, now, familySpaceId)

  ensureAiAssistantSeedForFamily(familySpaceId)
  return memberId
}

function createInternalUserForElder(memberId) {
  const db = getDatabase()
  const now = Date.now()
  const userId = createEntityId('user')
  const { hash, salt } = createPasswordHash(createOpaqueToken())

  db.prepare(`
    insert into users (id, email, password_hash, password_salt, email_verified_at, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, `elder+${memberId}@kinloop.local`.toLowerCase(), hash, salt, now, now, now)

  return userId
}

export function loginWithElderInviteCode(inviteCode) {
  const db = getDatabase()
  const normalizedInviteCode = `${inviteCode ?? ''}`.trim().toUpperCase()

  if (!normalizedInviteCode) {
    throw new Error('请输入老人专属邀请码。')
  }

  const invite = db.prepare(`
    select
      id,
      family_space_id as familySpaceId,
      target_member_id as targetMemberId
    from invite_codes
    where upper(code) = ?
      and requested_role = 'Elder'
      and status = 'ACTIVE'
    order by created_at desc
    limit 1
  `).get(normalizedInviteCode)

  if (!invite) {
    throw new Error('老人专属邀请码无效，请让家人重新生成。')
  }

  const userId = runInTransaction(() => {
    const now = Date.now()
    let elderMember = invite.targetMemberId ? getElderMemberById(invite.targetMemberId) : null

    if (!elderMember) {
      elderMember = getFirstElderMember(invite.familySpaceId)
    }

    if (!elderMember) {
      const memberId = ensureElderMemberForFamily({ familySpaceId: invite.familySpaceId, displayName: '长辈' })
      elderMember = getElderMemberById(memberId)
    }

    if (!elderMember || elderMember.familySpaceId !== invite.familySpaceId) {
      throw new Error('老人身份暂时无法确认，请让家人重新生成邀请码。')
    }

    if (invite.targetMemberId !== elderMember.id) {
      db.prepare('update invite_codes set target_member_id = ? where id = ?').run(elderMember.id, invite.id)
    }

    const nextUserId = elderMember.userId ?? createInternalUserForElder(elderMember.id)
    db.prepare(`
      update members
      set user_id = ?, last_activity_at = ?
      where id = ?
    `).run(nextUserId, now, elderMember.id)

    return nextUserId
  })

  return createSessionForUser(userId)
}

export function createInviteCodeForFamily({ familySpaceId, requestedRole, createdByMemberId, displayName }) {
  const db = getDatabase()
  const now = Date.now()
  const id = createEntityId('invite')
  const code = createFamilyJoinCode()
  const inviteRole = normalizeInviteRequestedRole(requestedRole)
  const targetMemberId = inviteRole === 'Elder'
    ? ensureElderMemberForFamily({ familySpaceId, displayName })
    : null
  const expiresAt = inviteRole === 'Elder' ? ELDER_INVITE_EXPIRES_AT : now + 7 * 24 * 60 * 60 * 1000

  db.prepare(`
    insert into invite_codes (
      id, family_space_id, code, status, requested_role, target_member_id, created_by_member_id,
      approved_member_id, expires_at, created_at, approved_at
    ) values (?, ?, ?, 'ACTIVE', ?, ?, ?, null, ?, ?, null)
  `).run(id, familySpaceId, code, inviteRole, targetMemberId, createdByMemberId, expiresAt, now)

  return getInviteCodeById(id)
}
