import express from 'express'
import { createServer } from 'node:http'
import { API_HOST, API_PORT, DB_PATH, UPLOADS_DIR } from './config.mjs'
import { WebSocketServer } from 'ws'
import { getDatabase } from './db/index.mjs'
import { acknowledgeAlert, createAlert, listActiveAlerts, resolveAlert } from './repositories/alertRepository.mjs'
import { createMessage, getConversationDetail, listConversationCards } from './repositories/conversationRepository.mjs'
import { getCurrentFamilySpace } from './repositories/familySpaceRepository.mjs'
import { createFollowup, listFollowups } from './repositories/followupRepository.mjs'
import { approveInviteCode, createInviteCode, listInviteCodes } from './repositories/inviteRepository.mjs'
import { listMembers } from './repositories/memberRepository.mjs'
import { createMemoryEntry, listMemories } from './repositories/memoryRepository.mjs'
import { listPermissionPolicies } from './repositories/permissionPolicyRepository.mjs'
import { listPulseHistory, listTodayPulses } from './repositories/pulseRepository.mjs'
import {
  analyzeEmotionsAndCreatePulses,
  isEmotionRequestValid,
  normalizeEmotionRequest,
  toErrorResponse,
} from './services/emotion/emotionService.mjs'
import { registerAsrRoutes } from './routes/asrRoutes.mjs'
import { registerAiIntentRoutes } from './routes/aiIntentRoutes.mjs'

getDatabase()

const app = express()
app.use(express.json({ limit: '30mb' }))
app.use('/uploads', express.static(UPLOADS_DIR))
const server = createServer(app)
const wss = new WebSocketServer({ server })
const realtimeClients = new Map()

function sendJson(ws, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(payload))
  }
}

function notifyConversationMembers(conversation, payload) {
  if (!conversation) return

  const targets = [conversation.familyMemberId, conversation.elderMemberId].filter(Boolean)
  for (const memberId of targets) {
    const client = realtimeClients.get(memberId)
    if (client) {
      sendJson(client, payload)
    }
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

app.get('/api/family-space', (_, response) => {
  response.json(getCurrentFamilySpace())
})

registerAsrRoutes(app)

registerAiIntentRoutes(app)

app.get('/api/members', (_, response) => {
  response.json(listMembers())
})

app.get('/api/conversations/cards', (request, response) => {
  const viewer = request.query?.viewer === 'family' ? 'family' : 'elder'
  response.json(listConversationCards(viewer))
})

app.get('/api/conversations/:conversationId', (request, response) => {
  const conversation = getConversationDetail(request.params.conversationId)

  if (!conversation) {
    response.status(404).json({ error: 'Conversation not found' })
    return
  }

  response.json(conversation)
})

app.post('/api/conversations/:conversationId/messages', (request, response) => {
  const conversation = getConversationDetail(request.params.conversationId)

  if (!conversation) {
    response.status(404).json({ error: 'Conversation not found' })
    return
  }

  const nextConversation = createMessage(request.params.conversationId, request.body)
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
      const familySpace = getCurrentFamilySpace()
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

app.get('/api/memories', (_, response) => {
  response.json(listMemories())
})

app.post('/api/memories', (request, response) => {
  response.status(201).json(createMemoryEntry(request.body))
})

app.get('/api/pulses/today', (_, response) => {
  response.json(listTodayPulses())
})

app.get('/api/pulses/history', (_, response) => {
  response.json(listPulseHistory())
})

app.post('/api/emotions/analyze', async (request, response) => {
  const familySpace = getCurrentFamilySpace()
  const payload = normalizeEmotionRequest(request.body, familySpace?.id ?? null)

  if (!isEmotionRequestValid(payload)) {
    response.status(400).json({
      code: 'EMOTION_INVALID_INPUT',
      message: 'conversationId/familySpaceId and at least one modality input are required.',
    })
    return
  }

  try {
    const result = await analyzeEmotionsAndCreatePulses(payload)
    response.status(201).json(result)
  } catch (error) {
    response.status(502).json(toErrorResponse(error))
  }
})

app.get('/api/followups', (_, response) => {
  response.json(listFollowups())
})

app.post('/api/followups', (request, response) => {
  response.status(201).json(createFollowup(request.body))
})

app.get('/api/alerts/active', (_, response) => {
  response.json(listActiveAlerts())
})

app.post('/api/alerts', (request, response) => {
  response.status(201).json(createAlert(request.body))
})

app.patch('/api/alerts/:alertId/acknowledge', (request, response) => {
  response.json(acknowledgeAlert(request.params.alertId, request.body.memberId))
})

app.patch('/api/alerts/:alertId/resolve', (request, response) => {
  response.json(resolveAlert(request.params.alertId, request.body))
})

app.get('/api/permission-policies', (_, response) => {
  response.json(listPermissionPolicies())
})

app.get('/api/invites', (_, response) => {
  response.json(listInviteCodes())
})

app.post('/api/invites', (request, response) => {
  response.status(201).json(createInviteCode(request.body))
})

app.patch('/api/invites/:inviteId/approve', (request, response) => {
  response.json(approveInviteCode(request.params.inviteId, request.body.approvedMemberId))
})

server.listen(API_PORT, API_HOST, () => {
  console.log(`Kinloop local api listening at http://${API_HOST}:${API_PORT}`)
})
