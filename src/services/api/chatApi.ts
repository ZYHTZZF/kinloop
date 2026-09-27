/* eslint-disable @typescript-eslint/no-explicit-any */
import { IMessage, IConversation, MessageStatus, MessageType } from './types'
import { messageStore } from '../../utils/storage'

interface SendMessageParams {
  conversationId: string
  senderId: string
  recipientId: string
  content: string
  type?: MessageType | 'text' | 'image' | 'voice'
  mediaUrl?: string
  voiceDurationMs?: number
}

interface WebSocketMessage {
  type: string
  data: any
  timestamp: number
}

let wsClient: WebSocket | null = null
const messageHandlers: Map<string, (msg: IMessage) => void> = new Map()
const statusHandlers: Map<string, (status: string) => void> = new Map()

// WebRTC Signaling Handler
let webrtcSignalHandler: ((signal: any) => void) | null = null

export function setWebrtcSignalHandler(handler: (signal: any) => void) {
  webrtcSignalHandler = handler
}

export function sendWebrtcSignal(signal: any) {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify(signal))
  } else {
    console.warn('[Chat] Cannot send WebRTC signal, WS not connected')
  }
}

/**
 * 初始化 WebSocket 连接
 */
export function initWebSocket(serverUrl: string, userId?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      wsClient = new WebSocket(serverUrl)

      wsClient.onopen = () => {
        console.log('[Chat] WebSocket connected')
        if (userId) {
          wsClient?.send(JSON.stringify({ type: 'register', userId }))
        }
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
      }
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 处理 WebSocket 消息
 */
async function handleWebSocketMessage(data: any): Promise<void> {
  const { type, data: msgData } = data

  if (['offer', 'answer', 'ice-candidate', 'reject', 'hangup'].includes(type)) {
    if (webrtcSignalHandler) webrtcSignalHandler(data)
    return
  }

  if (type === 'message') {
    const msg = msgData as IMessage
    await messageStore.saveMessage(msg)

    // 触发消息处理器
    const handler = messageHandlers.get(msg.conversationId)
    if (handler) {
      handler(msg)
    }
  } else if (type === 'message-status') {
    const { messageId, status } = msgData
    const handler = statusHandlers.get(messageId)
    if (handler) {
      handler(status)
    }
  }
}

/**
 * 发送文字消息
 */
export async function sendMessage(params: SendMessageParams): Promise<IMessage> {
  const msg: IMessage = {
    id: `${params.senderId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    conversationId: params.conversationId,
    senderId: params.senderId,
    recipientId: params.recipientId,
    content: params.content,
    type: params.type || MessageType.TEXT,
    status: MessageStatus.SENDING,
    timestamp: Date.now(),
    mediaUrl: params.mediaUrl,
    voiceDurationMs: params.voiceDurationMs
  }

  // 本地存储
  await messageStore.saveMessage(msg)

  // WebSocket 发送
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(
      JSON.stringify({
        type: 'message',
        data: msg,
        timestamp: Date.now()
      })
    )
  } else {
    console.warn('[Chat] WebSocket not connected, message queued for retry')
  }

  return msg
}

/**
 * 获取对话的所有消息
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<IMessage[]> {
  return messageStore.getMessages(conversationId, limit, offset)
}

/**
 * 获取某时间点之后的消息（用于同步离线消息）
 */
export async function getMessagesSince(
  conversationId: string,
  sinceTimestamp: number
): Promise<IMessage[]> {
  return messageStore.getMessagesSince(conversationId, sinceTimestamp)
}

/**
 * 标记消息为已读
 */
export async function markMessagesAsRead(
  messageIds: string[]
): Promise<void> {
  await messageStore.markAsRead(messageIds)

  // 通过 WebSocket 通知对方
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(
      JSON.stringify({
        type: 'mark-as-read',
        data: { messageIds },
        timestamp: Date.now()
      })
    )
  }
}

/**
 * 获取对话列表
 */
export async function getConversations(userId: string): Promise<IConversation[]> {
  return messageStore.getConversations(userId)
}

/**
 * 获取单个对话
 */
export async function getConversation(
  userId: string,
  otherUserId: string
): Promise<IConversation | null> {
  return messageStore.getConversation(userId, otherUserId)
}

/**
 * 创建或更新对话
 */
export async function saveConversation(conv: IConversation): Promise<void> {
  await messageStore.saveConversation(conv)
}

/**
 * 逻辑删除对话
 */
export async function deleteConversation(
  userId: string,
  otherUserId: string
): Promise<void> {
  await messageStore.deleteConversation(userId, otherUserId)
}

/**
 * 搜索消息
 */
export async function searchMessages(
  conversationId: string,
  query: string
): Promise<IMessage[]> {
  return messageStore.searchMessages(conversationId, query)
}

/**
 * 订阅对话消息更新
 */
export function onConversationMessage(
  conversationId: string,
  handler: (msg: IMessage) => void
): () => void {
  messageHandlers.set(conversationId, handler)

  // 返回取消订阅函数
  return () => {
    messageHandlers.delete(conversationId)
  }
}

/**
 * 订阅消息状态更新
 */
export function onMessageStatus(
  messageId: string,
  handler: (status: string) => void
): () => void {
  statusHandlers.set(messageId, handler)

  return () => {
    statusHandlers.delete(messageId)
  }
}

/**
 * 获取存储大小
 */
export async function getStorageSize(): Promise<{
  messages: number
  conversations: number
}> {
  return messageStore.getStorageSize()
}

/**
 * 清空所有本地存储
 */
export async function clearAllStorage(): Promise<void> {
  await messageStore.clearAll()
}

/**
 * 关闭 WebSocket 连接
 */
export function closeWebSocket(): void {
  if (wsClient) {
    wsClient.close()
    wsClient = null
  }
}

/**
 * 获取 WebSocket 连接状态
 */
export function isWebSocketConnected(): boolean {
  return wsClient !== null && wsClient.readyState === WebSocket.OPEN
}
