import type { IMessage, IConversation } from '../services/api/types'
import { MessageStatus } from '../services/api/types'

const DB_NAME = 'KinloopChat'
const DB_VERSION = 1
const STORE_MESSAGES = 'messages'
const STORE_CONVERSATIONS = 'conversations'

interface StorageConfig {
  dbName?: string
  version?: number
}

class MessageStore {
  private db: IDBDatabase | null = null
  private isInitialized = false

  async init(config?: StorageConfig): Promise<void> {
    if (this.isInitialized) return

    const dbName = config?.dbName || DB_NAME
    const version = config?.version || DB_VERSION

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        this.isInitialized = true
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create messages store
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const messageStore = db.createObjectStore(STORE_MESSAGES, {
            keyPath: 'id'
          })
          messageStore.createIndex('conversationId', 'conversationId', {
            unique: false
          })
          messageStore.createIndex('timestamp', 'timestamp', { unique: false })
          messageStore.createIndex('status', 'status', { unique: false })
        }

        // Create conversations store
        if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
          const convStore = db.createObjectStore(STORE_CONVERSATIONS, {
            keyPath: 'id'
          })
          convStore.createIndex('userId', 'userId', { unique: false })
          convStore.createIndex('lastActivityAt', 'lastActivityAt', {
            unique: false
          })
        }
      }
    })
  }

  private ensureDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    return this.db
  }

  async saveMessage(msg: IMessage): Promise<void> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MESSAGES], 'readwrite')
      const store = tx.objectStore(STORE_MESSAGES)
      const request = store.put(msg)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<IMessage[]> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MESSAGES], 'readonly')
      const store = tx.objectStore(STORE_MESSAGES)
      const index = store.index('conversationId')

      // Get all messages for this conversation, sorted by timestamp descending
      const range = IDBKeyRange.only(conversationId)
      const request = index.getAll(range)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const msgs = (request.result as IMessage[])
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(offset, offset + limit)
          .reverse()
        resolve(msgs)
      }
    })
  }

  async getMessagesSince(
    conversationId: string,
    sinceTimestamp: number
  ): Promise<IMessage[]> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MESSAGES], 'readonly')
      const store = tx.objectStore(STORE_MESSAGES)
      const index = store.index('conversationId')

      const range = IDBKeyRange.only(conversationId)
      const request = index.getAll(range)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const msgs = (request.result as IMessage[]).filter(
          (m) => m.timestamp > sinceTimestamp
        )
        resolve(msgs)
      }
    })
  }

  async markAsRead(messageIds: string[]): Promise<void> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MESSAGES], 'readwrite')
      const store = tx.objectStore(STORE_MESSAGES)

      messageIds.forEach((id) => {
        store.get(id).onsuccess = (event) => {
          const msg = (event.target as IDBRequest).result as IMessage
          if (msg && msg.status !== MessageStatus.READ) {
            msg.status = MessageStatus.READ
            store.put(msg)
          }
        }
      })

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async saveConversation(conv: IConversation): Promise<void> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CONVERSATIONS], 'readwrite')
      const store = tx.objectStore(STORE_CONVERSATIONS)
      const request = store.put(conv)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getConversations(userId: string): Promise<IConversation[]> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CONVERSATIONS], 'readonly')
      const store = tx.objectStore(STORE_CONVERSATIONS)
      const index = store.index('userId')

      const range = IDBKeyRange.only(userId)
      const request = index.getAll(range)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const convs = (request.result as IConversation[]).sort(
          (a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0)
        )
        resolve(convs)
      }
    })
  }

  async getConversation(userId: string, otherUserId: string): Promise<IConversation | null> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CONVERSATIONS], 'readonly')
      const store = tx.objectStore(STORE_CONVERSATIONS)
      const index = store.index('userId')

      const range = IDBKeyRange.only(userId)
      const request = index.getAll(range)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const convs = request.result as IConversation[]
        const conv =
          convs.find((c) => c.otherUserId === otherUserId && !c.isDeleted) || null
        resolve(conv)
      }
    })
  }

  async deleteConversation(userId: string, otherUserId: string): Promise<void> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CONVERSATIONS], 'readwrite')
      const store = tx.objectStore(STORE_CONVERSATIONS)
      const index = store.index('userId')

      const range = IDBKeyRange.only(userId)
      const request = index.getAll(range)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const convs = request.result as IConversation[]
        const conv = convs.find((c) => c.otherUserId === otherUserId)
        if (conv) {
          conv.isDeleted = true
          store.put(conv)
        }
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async searchMessages(
    conversationId: string,
    query: string
  ): Promise<IMessage[]> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MESSAGES], 'readonly')
      const store = tx.objectStore(STORE_MESSAGES)
      const index = store.index('conversationId')

      const range = IDBKeyRange.only(conversationId)
      const request = index.getAll(range)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const msgs = (request.result as IMessage[]).filter(
          (m) =>
            !m.isDeleted &&
            m.content &&
            m.content.toLowerCase().includes(query.toLowerCase())
        )
        resolve(msgs)
      }
    })
  }

  async clearAll(): Promise<void> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORE_MESSAGES, STORE_CONVERSATIONS],
        'readwrite'
      )
      tx.objectStore(STORE_MESSAGES).clear()
      tx.objectStore(STORE_CONVERSATIONS).clear()

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async getStorageSize(): Promise<{ messages: number; conversations: number }> {
    const db = this.ensureDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORE_MESSAGES, STORE_CONVERSATIONS],
        'readonly'
      )
      const msgStore = tx.objectStore(STORE_MESSAGES)
      const convStore = tx.objectStore(STORE_CONVERSATIONS)

      const msgCountReq = msgStore.count()
      const convCountReq = convStore.count()

      msgCountReq.onerror = () => reject(msgCountReq.error)
      convCountReq.onerror = () => reject(convCountReq.error)

      let msgCount = 0
      let convCount = 0
      let completed = 0

      msgCountReq.onsuccess = () => {
        msgCount = msgCountReq.result
        completed++
        if (completed === 2) {
          resolve({ messages: msgCount, conversations: convCount })
        }
      }

      convCountReq.onsuccess = () => {
        convCount = convCountReq.result
        completed++
        if (completed === 2) {
          resolve({ messages: msgCount, conversations: convCount })
        }
      }
    })
  }
}

// Export singleton instance
export const messageStore = new MessageStore()
