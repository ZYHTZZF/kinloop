import express from 'express'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { API_HOST, API_PORT, AUTH_DEV_EXPOSE_CODES, DB_PATH, UPLOADS_DIR } from './config.mjs'
import { WebSocketServer } from 'ws'
import { getDatabase } from './db/index.mjs'
import { acknowledgeAlert, createAlert, listActiveAlerts, resolveAlert } from './repositories/alertRepository.mjs'
import { createMessage, getConversationDetail, listConversationCards, markConversationUnreadAsRead } from './repositories/conversationRepository.mjs'
import { getFamilySpaceById } from './repositories/familySpaceRepository.mjs'
import { createFollowup, listFollowups } from './repositories/followupRepository.mjs'
import {
  createHeartPost,
  createHeartPostComment,
  listHeartPosts,
  toggleHeartPostLike,
} from './repositories/heartPostRepository.mjs'
import { approveInviteCode, listInviteCodes } from './repositories/inviteRepository.mjs'
import { listMembers } from './repositories/memberRepository.mjs'
import { createMemoryEntry, listMemories } from './repositories/memoryRepository.mjs'
import { listPermissionPolicies } from './repositories/permissionPolicyRepository.mjs'
import { getTodayEmotionSummary, listPulseHistory, listTodayPulses } from './repositories/pulseRepository.mjs'
import {
  analyzeEmotionsAndCreatePulses,
  isEmotionRequestValid,
  normalizeEmotionRequest,
  toErrorResponse,
} from './services/emotion/emotionService.mjs'
import {
  buildVideoCallEmotionSummary,
  isVideoCallEmotionSummaryRequestValid,
} from './services/emotion/videoCallSummaryService.mjs'
import { registerAsrRoutes } from './routes/asrRoutes.mjs'
import { registerAiIntentRoutes } from './routes/aiIntentRoutes.mjs'
import { registerGenerationBridgeRoutes } from './routes/generationBridgeRoutes.mjs'
import { registerPreSendSuggestionRoutes } from './routes/preSendSuggestionRoutes.mjs'
import { registerUnreadSummaryRoutes } from './routes/unreadSummaryRoutes.mjs'
import { registerVolcanoRoutes } from './routes/volcanoRoutes.mjs'
import { registerTtsRoutes } from './routes/ttsRoutes.mjs'
import memoryTriggerRoutes from './routes/memoryTriggerRoutes.mjs'
import {
  consumeAuthCode,
  createAuthCode,
  createInviteCodeForFamily,
  createRegisteredUser,
  deleteSession,
  findUserByEmail,
  getCurrentSessionPayload,
  getMembershipForUserId,
  getSessionByToken,
  loginUser,
  resetUserPassword,
} from './repositories/authRepository.mjs'
import { sendAuthCodeEmail } from './services/auth/emailService.mjs'

getDatabase()

const app = express()
app.use(express.json({ limit: '30mb' }))

// Register new memory trigger route
app.use('/api/memories', memoryTriggerRoutes)
app.use('/uploads', express.static(UPLOADS_DIR))
const server = createServer(app)
const wss = new WebSocketServer({ server })
const realtimeClients = new Map()
const HEART_POST_IMAGE_MAX_SIZE = 8 * 1024 * 1024
const HEART_POST_IMAGE_EXTENSIONS = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function sendJson(ws, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(payload))
  }
}

function notifyConversationMembers(conversation, payload) {
  if (!conversation) return

  const targets = Array.isArray(conversation.participants) && conversation.participants.length > 0
    ? conversation.participants.map((participant) => participant.id).filter(Boolean)
    : [conversation.familyMemberId, conversation.elderMemberId].filter(Boolean)

  for (const memberId of targets) {
    const client = realtimeClients.get(memberId)
    if (client) {
      sendJson(client, payload)
    }
  }
}

function getBearerToken(request) {
  const header = `${request.headers.authorization ?? ''}`
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? null
}

function requireAuth(request, response, next) {
  const token = getBearerToken(request)
  if (!token) {
    response.status(401).json({ error: 'Missing bearer token' })
    return
  }

  const session = getSessionByToken(token)
  if (!session) {
    response.status(401).json({ error: 'Session expired or invalid' })
    return
  }

  request.auth = {
    token,
    user: session.user,
    membership: session.membership,
  }
  next()
}

function getFamilySpaceIdFromRequest(request) {
  return request.auth?.membership?.familySpaceId ?? null
}

function getViewerRole(request) {
  return request.auth?.membership?.role === 'elder' ? 'elder' : 'family'
}

function getViewerContext(request) {
  return {
    role: getViewerRole(request),
    memberId: request.auth?.membership?.memberId ?? null,
  }
}

function parseHeartPostImageDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(`${dataUrl ?? ''}`.trim())
  if (!match) {
    throw new Error('请选择一张有效的图片。')
  }

  const mimeType = match[1].toLowerCase()
  const extension = HEART_POST_IMAGE_EXTENSIONS[mimeType]
  if (!extension) {
    throw new Error('目前只支持 JPG、PNG、WEBP 或 GIF 图片。')
  }

  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length) {
    throw new Error('图片读取失败，请重新选择。')
  }

  if (buffer.length > HEART_POST_IMAGE_MAX_SIZE) {
    throw new Error('图片不能超过 8MB。')
  }

  return { buffer, extension }
}

function saveHeartPostImageUpload(dataUrl, request) {
  const { buffer, extension } = parseHeartPostImageDataUrl(dataUrl)
  const targetDir = resolve(UPLOADS_DIR, 'heart-posts')
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`

  mkdirSync(targetDir, { recursive: true })
  writeFileSync(resolve(targetDir, fileName), buffer)

  const protocol = request.protocol || 'http'
  const host = request.get('host') || `127.0.0.1:${API_PORT}`

  return {
    imageUrl: `${protocol}://${host}/uploads/heart-posts/${fileName}`,
  }
}

const WEATHER_CODE_LABELS = {
  0: '晴',
  1: '晴间多云',
  2: '多云',
  3: '阴',
  45: '有雾',
  48: '有雾',
  51: '毛毛雨',
  53: '小雨',
  55: '中雨',
  56: '冻毛毛雨',
  57: '冻毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '冻雨',
  67: '冻雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '阵雪',
  80: '阵雨',
  81: '强阵雨',
  82: '暴雨',
  85: '阵雪',
  86: '强阵雪',
  95: '雷雨',
  96: '雷雨冰雹',
  99: '强雷雨冰雹',
}

function mapWeatherCodeToLabel(code) {
  return WEATHER_CODE_LABELS[code] ?? '天气正常'
}

function buildWeatherAdvice(code, temperature) {
  if (code >= 95) {
    return '武汉当前有雷雨天气，尽量减少外出，记得关好门窗。'
  }

  if ([61, 63, 65, 80, 81, 82].includes(code)) {
    return '武汉现在有降雨，出门记得带伞，路上慢一点更稳妥。'
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return '天气偏冷，注意保暖，地面湿滑时尽量少走急路。'
  }

  if (temperature >= 32) {
    return '武汉气温较高，注意补水，午后尽量在阴凉处活动。'
  }

  if (temperature <= 10) {
    return '武汉气温偏低，出门加件外套，早晚注意保暖。'
  }

  return '天气比较平稳，适合按自己的节奏出门走一走。'
}

async function geocodeCity(city) {
  const params = new URLSearchParams({
    name: city,
    count: '1',
    language: 'zh',
    format: 'json',
  })

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status}`)
  }

  const payload = await response.json()
  const location = payload?.results?.[0]

  if (!location) {
    throw new Error(`City not found: ${city}`)
  }

  return {
    name: location.name ?? city,
    latitude: location.latitude,
    longitude: location.longitude,
  }
}

async function fetchCurrentWeather(city = '武汉') {
  const location = await geocodeCity(city)
  const params = new URLSearchParams({
    latitude: `${location.latitude}`,
    longitude: `${location.longitude}`,
    current_weather: 'true',
    timezone: 'Asia/Shanghai',
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`)
  }

  const payload = await response.json()
  const current = payload?.current_weather

  if (!current || typeof current.temperature !== 'number') {
    throw new Error('Current weather is unavailable')
  }

  const weatherCode = Number(current.weathercode ?? -1)
  const temperature = Math.round(current.temperature)

  return {
    city: location.name || city,
    weatherLabel: mapWeatherCodeToLabel(weatherCode),
    temperatureLabel: `${temperature}°C`,
    advice: buildWeatherAdvice(weatherCode, temperature),
    fetchedAt: Date.now(),
  }
}

wss.on('connection', (ws) => {
  let registeredUserId = null

  ws.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString())

      if (message.type === 'register' && typeof message.userId === 'string') {
        registeredUserId = message.userId
        realtimeClients.set(registeredUserId, ws)
        sendJson(ws, { type: 'registered', userId: registeredUserId, timestamp: Date.now() })
        return
      }

      if (message.type === 'webrtc-signal' && message.data?.to) {
        const target = realtimeClients.get(message.data.to)
        if (target) {
          sendJson(target, { type: 'webrtc-signal', data: message.data, timestamp: Date.now() })
        }
      }
    } catch (error) {
      console.warn('[ws] failed to process message', error)
    }
  })

  ws.on('close', () => {
    if (registeredUserId && realtimeClients.get(registeredUserId) === ws) {
      realtimeClients.delete(registeredUserId)
    }
  })
})

app.use((_, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  next()
})

app.use((request, response, next) => {
  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }

  next()
})

app.get('/api/health', (_, response) => {
  response.json({
    ok: true,
    service: 'kinloop-local-api',
    dbPath: DB_PATH,
    timestamp: Date.now(),
  })
})

app.post('/api/auth/send-code', async (request, response) => {
  const email = `${request.body?.email ?? ''}`.trim().toLowerCase()
  const purpose = request.body?.purpose === 'reset_password' ? 'reset_password' : 'register'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    response.status(400).json({ error: '请输入有效邮箱地址。' })
    return
  }

  const existingUser = findUserByEmail(email)
  const existingMembership = existingUser ? getMembershipForUserId(existingUser.id) : null
  if (purpose === 'register' && existingUser && existingMembership) {
    response.status(409).json({ error: '该邮箱已注册，请直接登录。' })
    return
  }
  if (purpose === 'reset_password' && !existingUser) {
    response.status(404).json({ error: '该邮箱尚未注册。' })
    return
  }

  try {
    const authCode = createAuthCode(email, purpose)
    let delivery = 'email'

    try {
      await sendAuthCodeEmail({ email, code: authCode.code, purpose })
    } catch (emailError) {
      if (!AUTH_DEV_EXPOSE_CODES) {
        throw emailError
      }

      delivery = 'dev-fallback'
      console.warn('[auth] email delivery failed, exposing code because KINLOOP_AUTH_DEV_EXPOSE_CODES=true')
      console.warn('[auth] target:', email, 'purpose:', purpose, 'code:', authCode.code)
      console.warn('[auth] email error:', emailError instanceof Error ? emailError.message : emailError)
    }

    response.status(201).json({
      ok: true,
      email,
      purpose,
      expiresAt: authCode.expiresAt,
      delivery,
      ...(AUTH_DEV_EXPOSE_CODES ? { devCode: authCode.code } : {}),
    })
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : '发送验证码失败',
    })
  }
})

app.post('/api/auth/register', (request, response) => {
  const email = `${request.body?.email ?? ''}`.trim().toLowerCase()
  const code = `${request.body?.code ?? ''}`.trim()
  const password = `${request.body?.password ?? ''}`

  if (!email || !code || password.length < 8) {
    response.status(400).json({ error: '请填写邮箱、验证码和至少 8 位密码。' })
    return
  }

  try {
    consumeAuthCode(email, 'register', code)
    const session = createRegisteredUser({
      email,
      password,
      role: request.body?.role,
      familyAction: request.body?.familyAction,
      familyName: request.body?.familyName,
      familyCode: request.body?.familyCode,
      displayName: request.body?.displayName,
      relationLabel: request.body?.relationLabel,
    })
    response.status(201).json(session)
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : '注册失败',
    })
  }
})

app.post('/api/auth/login', (request, response) => {
  const email = `${request.body?.email ?? ''}`.trim().toLowerCase()
  const password = `${request.body?.password ?? ''}`

  if (!email || !password) {
    response.status(400).json({ error: '请输入邮箱和密码。' })
    return
  }

  try {
    response.json(loginUser({ email, password }))
  } catch (error) {
    response.status(401).json({
      error: error instanceof Error ? error.message : '登录失败',
    })
  }
})

app.post('/api/auth/reset-password', (request, response) => {
  const email = `${request.body?.email ?? ''}`.trim().toLowerCase()
  const code = `${request.body?.code ?? ''}`.trim()
  const newPassword = `${request.body?.newPassword ?? ''}`

  if (!email || !code || newPassword.length < 8) {
    response.status(400).json({ error: '请输入邮箱、验证码和至少 8 位新密码。' })
    return
  }

  try {
    consumeAuthCode(email, 'reset_password', code)
    response.json(resetUserPassword({ email, newPassword }))
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : '重置密码失败',
    })
  }
})

app.use('/api', (request, response, next) => {
  if (
    request.path === '/health'
    || request.path === '/weather/current'
    || request.path === '/auth/send-code'
    || request.path === '/auth/register'
    || request.path === '/auth/login'
    || request.path === '/auth/reset-password'
  ) {
    next()
    return
  }

  requireAuth(request, response, next)
})

app.get('/api/auth/me', (request, response) => {
  const session = getCurrentSessionPayload(request.auth.token)
  if (!session) {
    response.status(401).json({ error: 'Session expired or invalid' })
    return
  }
  response.json(session)
})

app.post('/api/auth/logout', (request, response) => {
  deleteSession(request.auth.token)
  response.status(204).end()
})

app.get('/api/weather/current', async (request, response) => {
  const city = `${request.query?.city ?? '武汉'}`.trim() || '武汉'

  try {
    response.json(await fetchCurrentWeather(city))
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to load current weather',
    })
  }
})

app.get('/api/family-space', (request, response) => {
  response.json(getFamilySpaceById(getFamilySpaceIdFromRequest(request)))
})

registerAsrRoutes(app)

registerAiIntentRoutes(app)

registerGenerationBridgeRoutes(app)

registerPreSendSuggestionRoutes(app)

registerUnreadSummaryRoutes(app)

registerVolcanoRoutes(app)

registerTtsRoutes(app)

app.get('/api/members', (request, response) => {
  response.json(listMembers(getFamilySpaceIdFromRequest(request)))
})

app.get('/api/heart-posts', (request, response) => {
  response.json(listHeartPosts(
    getFamilySpaceIdFromRequest(request),
    request.auth.membership.memberId,
  ))
})

app.post('/api/heart-posts/upload-image', (request, response) => {
  try {
    response.status(201).json(saveHeartPostImageUpload(request.body?.dataUrl, request))
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : '上传图片失败',
    })
  }
})

app.post('/api/heart-posts', (request, response) => {
  try {
    response.status(201).json(createHeartPost(
      request.body,
      getFamilySpaceIdFromRequest(request),
      request.auth.membership.memberId,
      request.auth.membership.memberId,
    ))
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : '发布心语失败',
    })
  }
})

app.post('/api/heart-posts/:postId/likes/toggle', (request, response) => {
  try {
    response.json(toggleHeartPostLike(
      request.params.postId,
      getFamilySpaceIdFromRequest(request),
      request.auth.membership.memberId,
    ))
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : '点赞失败',
    })
  }
})

app.post('/api/heart-posts/:postId/comments', (request, response) => {
  try {
    response.status(201).json(createHeartPostComment(
      request.params.postId,
      request.body,
      getFamilySpaceIdFromRequest(request),
      request.auth.membership.memberId,
    ))
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : '评论失败',
    })
  }
})

app.get('/api/conversations/cards', (request, response) => {
  const requestedViewer = request.query?.viewer === 'elder' ? 'elder' : request.query?.viewer === 'family' ? 'family' : getViewerRole(request)
  const viewer = getViewerRole(request) === 'elder' ? 'elder' : requestedViewer === 'family' ? 'family' : 'family'
  response.json(listConversationCards(getFamilySpaceIdFromRequest(request), viewer, request.auth.membership.memberId))
})

app.get('/api/conversations/:conversationId', (request, response) => {
  const conversation = getConversationDetail(
    request.params.conversationId,
    getFamilySpaceIdFromRequest(request),
    getViewerRole(request),
    request.auth.membership.memberId,
  )

  if (!conversation) {
    response.status(404).json({ error: 'Conversation not found' })
    return
  }

  response.json(conversation)
})

app.patch('/api/conversations/:conversationId/read-all', (request, response) => {
  const viewer = request.body?.requesterRole === 'family' ? 'family' : request.body?.requesterRole === 'elder' ? 'elder' : null
  if (!viewer) {
    response.status(400).json({ error: 'requesterRole must be elder or family' })
    return
  }

  const conversation = getConversationDetail(
    request.params.conversationId,
    getFamilySpaceIdFromRequest(request),
    getViewerRole(request),
    request.auth.membership.memberId,
  )
  if (!conversation) {
    response.status(404).json({ error: 'Conversation not found' })
    return
  }

  response.json(markConversationUnreadAsRead(
    request.params.conversationId,
    getFamilySpaceIdFromRequest(request),
    viewer,
    request.auth.membership.memberId,
  ))
})

app.post('/api/conversations/:conversationId/messages', (request, response) => {
  const conversation = getConversationDetail(
    request.params.conversationId,
    getFamilySpaceIdFromRequest(request),
    getViewerRole(request),
    request.auth.membership.memberId,
  )

  if (!conversation) {
    response.status(404).json({ error: 'Conversation not found' })
    return
  }

  const nextConversation = createMessage(
    request.params.conversationId,
    getFamilySpaceIdFromRequest(request),
    request.body,
    getViewerRole(request),
    request.auth.membership.memberId,
  )
  const createdMessage = nextConversation.messages.at(-1) ?? null
  response.status(201).json(nextConversation)
  notifyConversationMembers(nextConversation, {
    type: 'conversation-updated',
    data: {
      conversationId: nextConversation.id,
      conversation: nextConversation,
    },
    timestamp: Date.now(),
  })

  // Fire-and-forget emotion analysis. Messaging should never be blocked by provider latency.
  void (async () => {
    try {
      const familySpace = getFamilySpaceById(getFamilySpaceIdFromRequest(request))
      const messageType = `${createdMessage?.messageType ?? request.body?.messageType ?? ''}`.toLowerCase()
      const textContent = createdMessage?.textContent ?? request.body?.textContent ?? null
      const transcript = createdMessage?.transcript ?? request.body?.transcript ?? null
      const mediaUrl = createdMessage?.mediaUrl ?? request.body?.mediaUrl ?? null

      const payload = normalizeEmotionRequest(
        {
          conversationId: request.params.conversationId,
          familySpaceId: familySpace?.id ?? null,
          sourceMessageId: createdMessage?.id ?? null,
          text: textContent,
          imageUrl: messageType === 'image' || messageType === 'mixed' ? mediaUrl : null,
          audioUrl: messageType === 'voice' || messageType === 'mixed' ? mediaUrl : null,
          transcript,
        },
        familySpace?.id ?? null,
      )

      if (!isEmotionRequestValid(payload)) {
        return
      }

      await analyzeEmotionsAndCreatePulses(payload)
    } catch (error) {
      const details = toErrorResponse(error)
      console.warn('[emotion:auto-analyze] skipped:', details.code, details.message)
    }
  })()
})

app.get('/api/memories', (request, response) => {
  response.json(listMemories(getFamilySpaceIdFromRequest(request)))
})

app.post('/api/memories', (request, response) => {
  response.status(201).json(createMemoryEntry(request.body, getFamilySpaceIdFromRequest(request)))
})

app.get('/api/pulses/today', (request, response) => {
  response.json(listTodayPulses(getFamilySpaceIdFromRequest(request), getViewerContext(request)))
})

app.get('/api/pulses/history', (request, response) => {
  response.json(listPulseHistory(getFamilySpaceIdFromRequest(request), getViewerContext(request)))
})

app.get('/api/pulses/today-summary', (request, response) => {
  response.json(getTodayEmotionSummary(getFamilySpaceIdFromRequest(request), getViewerContext(request)))
})

app.post('/api/emotions/analyze', async (request, response) => {
  const familySpace = getFamilySpaceById(getFamilySpaceIdFromRequest(request))
  const payload = normalizeEmotionRequest(request.body, familySpace?.id ?? null)

  if (!isEmotionRequestValid(payload)) {
    response.status(400).json({
      code: 'EMOTION_INVALID_INPUT',
      message: 'conversationId/familySpaceId and at least one modality input are required.',
    })
    return
  }

  const conversation = getConversationDetail(
    payload.conversationId,
    getFamilySpaceIdFromRequest(request),
    getViewerRole(request),
    request.auth.membership.memberId,
  )
  if (!conversation) {
    response.status(404).json({ error: 'Conversation not found' })
    return
  }

  try {
    const result = await analyzeEmotionsAndCreatePulses(payload)
    response.status(201).json(result)
  } catch (error) {
    response.status(502).json(toErrorResponse(error))
  }
})

app.post('/api/emotions/video-call-summary', (request, response) => {
  const familySpace = getFamilySpaceById(getFamilySpaceIdFromRequest(request))
  const payload = {
    ...request.body,
    familySpaceId: request.body?.familySpaceId ?? familySpace?.id ?? null,
  }

  if (!isVideoCallEmotionSummaryRequestValid(payload)) {
    response.status(400).json({
      code: 'EMOTION_INVALID_INPUT',
      message: 'conversationId/familySpaceId/callType/targetRole and summary samples are required.',
    })
    return
  }

  const conversation = getConversationDetail(
    payload.conversationId,
    getFamilySpaceIdFromRequest(request),
    getViewerRole(request),
    request.auth.membership.memberId,
  )
  if (!conversation) {
    response.status(404).json({ error: 'Conversation not found' })
    return
  }

  const summaryResult = buildVideoCallEmotionSummary(payload)
  const nextConversation = createMessage(
    payload.conversationId,
    getFamilySpaceIdFromRequest(request),
    {
      senderType: 'System',
      senderMemberId: null,
      messageType: 'Text',
      textContent: summaryResult.summary,
      aiDrafted: false,
      isLowInformation: false,
    },
    getViewerRole(request),
    request.auth.membership.memberId,
  )
  const createdMessage = nextConversation.messages.at(-1) ?? null

  notifyConversationMembers(nextConversation, {
    type: 'conversation-updated',
    data: {
      conversationId: nextConversation.id,
      conversation: nextConversation,
    },
    timestamp: Date.now(),
  })

  response.status(201).json({
    ...summaryResult,
    createdMessage,
  })
})

app.get('/api/followups', (request, response) => {
  response.json(listFollowups(getFamilySpaceIdFromRequest(request)))
})

app.post('/api/followups', (request, response) => {
  response.status(201).json(createFollowup(request.body))
})

app.get('/api/alerts/active', (request, response) => {
  response.json(listActiveAlerts(getFamilySpaceIdFromRequest(request)))
})

app.post('/api/alerts', (request, response) => {
  response.status(201).json(createAlert(request.body, getFamilySpaceIdFromRequest(request)))
})

app.patch('/api/alerts/:alertId/acknowledge', (request, response) => {
  response.json(acknowledgeAlert(
    request.params.alertId,
    request.body.memberId,
    getFamilySpaceIdFromRequest(request),
  ))
})

app.patch('/api/alerts/:alertId/resolve', (request, response) => {
  response.json(resolveAlert(request.params.alertId, request.body, getFamilySpaceIdFromRequest(request)))
})

app.get('/api/permission-policies', (request, response) => {
  response.json(listPermissionPolicies(getFamilySpaceIdFromRequest(request)))
})

app.get('/api/invites', (request, response) => {
  response.json(listInviteCodes(getFamilySpaceIdFromRequest(request)))
})

app.post('/api/invites', (request, response) => {
  response.status(201).json(createInviteCodeForFamily({
    familySpaceId: getFamilySpaceIdFromRequest(request),
    requestedRole: request.body?.requestedRole ?? 'Family',
    createdByMemberId: request.auth.membership.memberId,
  }))
})

app.patch('/api/invites/:inviteId/approve', (request, response) => {
  response.json(approveInviteCode(
    request.params.inviteId,
    request.body.approvedMemberId,
    getFamilySpaceIdFromRequest(request),
  ))
})

app.use((error, request, response, _next) => {
  console.error(error)

  if (response.headersSent) {
    return
  }

  const message = error instanceof Error ? error.message : '服务器开小差了，请稍后再试。'
  const isApiRequest = request.path?.startsWith('/api/')
  if (isApiRequest) {
    response.status(500).json({ error: message || '服务器开小差了，请稍后再试。' })
    return
  }

  response.status(500).send('服务器开小差了，请稍后再试。')
})

server.listen(API_PORT, API_HOST, () => {
  console.log(`Kinloop local api listening at http://${API_HOST}:${API_PORT}`)
})
