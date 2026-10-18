import type { IConversation, IMessage, ICallSignal, MessageType } from './types'
import { messageStore } from '../../utils/storage'
import { getWebSocketUrl } from './realtime'

interface SendMessageParams {
  conversationId: string
  senderId: string
  recipientId: string
  content: string
  type?: MessageType | 'text' | 'image' | 'voice' | 'video'
  mediaUrl?: string
  voiceDurationMs?: number
}

interface WebSocketMessage {
  type: string
  data: unknown
  timestamp: number
}

let wsClient: WebSocket | null = null
let registeredUserId: string | null = null
const messageHandlers = new Map<string, (msg: IMessage) => void>()
const statusHandlers = new Map<string, (status: string) => void>()
let webrtcSignalHandler: ((signal: ICallSignal) => void | Promise<void>) | null = null
let conversationUpdateHandler: ((payload: { conversationId: string; conversation?: unknown }) => void | Promise<void>) | null = null

export function initWebSocket(serverUrl: string, userId?: string): Promise<void> {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    if (userId && userId !== registeredUserId) {
      registeredUserId = userId
      wsClient.send(JSON.stringify({ type: 'register', userId }))
    }
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    try {
      const resolvedServerUrl = serverUrl || getWebSocketUrl()
      wsClient = new WebSocket(resolvedServerUrl)
      registeredUserId = userId ?? null

      wsClient.onopen = () => {
        if (registeredUserId) {
          wsClient?.send(JSON.stringify({ type: 'register', userId: registeredUserId }))
        }
        console.log('[Chat] WebSocket connected')
        resolve()
      }

      wsClient.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage
          await handleWebSocketMessage(data)
        } catch (error) {
          console.error('[Chat] Failed to parse WebSocket message:', error)
        }
      }

      wsClient.onerror = (error) => {
        console.error('[Chat] WebSocket error:', error)
        reject(error)
      }

      wsClient.onclose = () => {
        console.log('[Chat] WebSocket disconnected')
        wsClient = null
      }
    } catch (error) {
      reject(error)
    }
  })
}

async function handleWebSocketMessage(message: WebSocketMessage): Promise<void> {
  const payload = message.data as Record<string, unknown> | null

  if (message.type === 'message' && payload) {
    const msg = payload as unknown as IMessage
    await messageStore.saveMessage(msg)
    messageHandlers.get(msg.conversationId)?.(msg)
    return
  }

  if (message.type === 'message-status' && payload) {
    const messageId = typeof payload.messageId === 'string' ? payload.messageId : null
    const status = typeof payload.status === 'string' ? payload.status : null
    if (messageId && status) {
      statusHandlers.get(messageId)?.(status)
    }
    return
  }

  if ((message.type === 'webrtc-signal' || message.type === 'call-signal') && payload && webrtcSignalHandler) {
    await webrtcSignalHandler(payload as unknown as ICallSignal)
    return
  }

  if (message.type === 'conversation-updated' && payload && conversationUpdateHandler) {
    const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : null
    if (conversationId) {
      await conversationUpdateHandler({
        conversationId,
        conversation: payload.conversation
      })
    }
  }
}

export async function sendMessage(params: SendMessageParams): Promise<IMessage> {
  const msg: IMessage = {
    id: `${params.senderId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    conversationId: params.conversationId,
    senderId: params.senderId,
    recipientId: params.recipientId,
    content: params.content,
    type: params.type ?? 'text',
    status: 'sending',
    timestamp: Date.now(),
    mediaUrl: params.mediaUrl,
    voiceDurationMs: params.voiceDurationMs
  }

  await messageStore.saveMessage(msg)

  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ type: 'message', data: msg, timestamp: Date.now() }))
  } else {
    console.warn('[Chat] WebSocket not connected, message queued for retry')
  }

  return msg
}

export async function getMessages(conversationId: string, limit: number = 50, offset: number = 0): Promise<IMessage[]> {
  return messageStore.getMessages(conversationId, limit, offset)
}

export async function getMessagesSince(conversationId: string, sinceTimestamp: number): Promise<IMessage[]> {
  return messageStore.getMessagesSince(conversationId, sinceTimestamp)
}

export async function markMessagesAsRead(messageIds: string[]): Promise<void> {
  await messageStore.markAsRead(messageIds)

  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify({ type: 'mark-as-read', data: { messageIds }, timestamp: Date.now() }))
  }
}

export async function getConversations(userId: string): Promise<IConversation[]> {
  return messageStore.getConversations(userId)
}

export async function getConversation(userId: string, otherUserId: string): Promise<IConversation | null> {
  return messageStore.getConversation(userId, otherUserId)
}

export async function saveConversation(conv: IConversation): Promise<void> {
  await messageStore.saveConversation(conv)
}

export async function deleteConversation(userId: string, otherUserId: string): Promise<void> {
  await messageStore.deleteConversation(userId, otherUserId)
}

export async function searchMessages(conversationId: string, query: string): Promise<IMessage[]> {
  return messageStore.searchMessages(conversationId, query)
}

export function onConversationMessage(conversationId: string, handler: (msg: IMessage) => void): () => void {
  messageHandlers.set(conversationId, handler)
  return () => {
    messageHandlers.delete(conversationId)
  }
}

export function onMessageStatus(messageId: string, handler: (status: string) => void): () => void {
  statusHandlers.set(messageId, handler)
  return () => {
    statusHandlers.delete(messageId)
  }
}

export function setWebrtcSignalHandler(handler: ((signal: ICallSignal) => void | Promise<void>) | null): void {
  webrtcSignalHandler = handler
}

export function setConversationUpdateHandler(
  handler: ((payload: { conversationId: string; conversation?: unknown }) => void | Promise<void>) | null
): void {
  conversationUpdateHandler = handler
}

export function sendWebrtcSignal(signal: ICallSignal): void {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
    console.warn('[Chat] WebSocket not connected, signaling message dropped')
    return
  }

  wsClient.send(JSON.stringify({ type: 'webrtc-signal', data: signal, timestamp: Date.now() }))
}

export async function getStorageSize(): Promise<{ messages: number; conversations: number }> {
  return messageStore.getStorageSize()
}

export async function clearAllStorage(): Promise<void> {
  await messageStore.clearAll()
}

export function closeWebSocket(): void {
  if (wsClient) {
    wsClient.close()
    wsClient = null
    registeredUserId = null
  }
}

export function isWebSocketConnected(): boolean {
  return wsClient !== null && wsClient.readyState === WebSocket.OPEN
}
