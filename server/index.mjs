import express from 'express'
import { API_HOST, API_PORT, DB_PATH } from './config.mjs'
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
import { registerAiIntentRoutes } from './routes/aiIntentRoutes.mjs'
import { registerAsrRoutes } from './routes/asrRoutes.mjs'
import { registerVolcanoRoutes } from './routes/volcanoRoutes.mjs'

getDatabase()

const app = express()
app.use(express.json())

app.use((_, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

app.get('/api/members', (_, response) => {
  response.json(listMembers())
})

app.get('/api/conversations/cards', (_, response) => {
  response.json(listConversationCards())
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

  response.status(201).json(createMessage(request.params.conversationId, request.body))
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

registerAiIntentRoutes(app)
registerAsrRoutes(app)

// 注册火山引擎 API 路由
registerVolcanoRoutes(app)

import { createServer } from 'http'
import { WebSocketServer } from 'ws'

const server = createServer(app)
const wss = new WebSocketServer({ server })

// 保存用户的 WebSocket 连接
const clients = new Map()

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      
      // 注册用户连接
      if (msg.type === 'register' && msg.userId) {
        clients.set(msg.userId, ws)
        console.log(`User ${msg.userId} registered for WS`)
      } 
      // 转发点对点消息 (主要是 Webrtc Signaling)
      else if (msg.to) {
        const targetWs = clients.get(msg.to)
        if (targetWs && targetWs.readyState === 1) { // 1 = OPEN
          targetWs.send(JSON.stringify(msg))
        }
      } 
      // 广播其他消息 (Fallback)
      else {
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify(msg))
          }
        })
      }
    } catch (e) {
      console.error('WS Error parsing message:', e)
    }
  })

  ws.on('close', () => {
    clients.forEach((clientWs, userId) => {
      if (clientWs === ws) {
        clients.delete(userId)
        console.log(`User ${userId} WS disconnected`)
      }
    })
  })
})

server.listen(API_PORT, API_HOST, () => {
  console.log(`Kinloop local api with WebSocket listening at http://${API_HOST}:${API_PORT}`)
})
