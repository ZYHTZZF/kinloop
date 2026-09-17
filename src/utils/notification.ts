import { INotificationOptions } from '../services/api/types'

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

/**
 * 显示系统通知
 */
export function showNotification(
  title: string,
  options?: INotificationOptions
): Notification | null {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported')
    return null
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted')
    return null
  }

  try {
    const notification = new Notification(title, {
      icon: '/icons/logo.png',
      badge: '/icons/badge.png',
      ...options
    })

    // 5 秒后自动关闭（如果 requireInteraction 为 false）
    if (!options?.requireInteraction) {
      setTimeout(() => {
        notification.close()
      }, 5000)
    }

    return notification
  } catch (error) {
    console.error('Failed to show notification:', error)
    return null
  }
}

/**
 * 关闭指定的通知
 */
export function closeNotification(tag?: string): void {
  if (!('Notification' in window)) {
    return
  }

  // Service Worker 方式（如果有的话）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage({
      type: 'CLOSE_NOTIFICATION',
      tag
    })
  }
}

/**
 * 显示消息通知
 */
export function notifyNewMessage(
  senderName: string,
  messagePreview: string
): Notification | null {
  return showNotification(`消息来自 ${senderName}`, {
    body: messagePreview,
    tag: 'new-message',
    data: { type: 'message' }
  })
}

/**
 * 显示来电通知
 */
export function notifyIncomingCall(
  callerName: string,
  callType: 'voice' | 'video'
): Notification | null {
  const title = callType === 'video' ? `${callerName} 来视频通话` : `${callerName} 来电`

  return showNotification(title, {
    tag: 'incoming-call',
    requireInteraction: true,
    data: { type: 'call', callType }
  })
}

/**
 * 显示未读消息通知
 */
export function notifyUnreadMessages(count: number): Notification | null {
  return showNotification('未读消息', {
    body: `你有 ${count} 条未读消息`,
    tag: 'unread-count',
    data: { type: 'unread', count }
  })
}

/**
 * 监听通知点击事件
 */
export function onNotificationClick(
  callback: (notification: Notification) => void
): () => void {
  const handler = (event: Event) => {
    const notification = event as unknown as { notification: Notification }
    callback(notification.notification)
  }

  if ('Notification' in window) {
    // 用于从 Service Worker 打开通知
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NOTIFICATION_CLICK') {
          callback(event.data.notification)
        }
      })
    }
  }

  // 取消监听函数
  return () => {
    // 移除监听
  }
}

/**
 * Web Audio API - 播放通知音
 */
export async function playNotificationSound(soundFile?: string): Promise<void> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.connect(gain)
    gain.connect(audioContext.destination)

    // 短促的蜂鸣声
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)

    gain.gain.setValueAtTime(0.3, audioContext.currentTime)
    gain.gain.setValueAtTime(0, audioContext.currentTime + 0.2)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch (error) {
    console.error('Failed to play notification sound:', error)
  }
}

/**
 * 检查通知支持
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window
}

/**
 * 获取通知权限状态
 */
export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' {
  if (!('Notification' in window)) {
    return 'denied'
  }

  return Notification.permission as 'granted' | 'denied' | 'default'
}

/**
 * 批量关闭所有通知（某个类型）
 */
export function closeAllNotifications(tag?: string): void {
  // 注意：由于安全限制，脚本无法直接访问 Notification 实例列表
  // 这里只能通过 Service Worker 或其他方式实现
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLOSE_ALL_NOTIFICATIONS',
      tag
    })
  }
}
