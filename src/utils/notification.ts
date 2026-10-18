import type { INotificationOptions } from '../services/api/types'
import {
  closePlatformNotifications,
  showPlatformNotification,
  type NotificationLike,
} from '../platform/notifications'
import {
  ensureNotificationPermission,
  getNotificationPermissionStatus as getPlatformNotificationPermissionStatus,
} from '../platform/permissions'

export async function requestNotificationPermission(): Promise<boolean> {
  return ensureNotificationPermission()
}

export async function showNotification(
  title: string,
  options?: INotificationOptions,
): Promise<NotificationLike | null> {
  try {
    const notification = await showPlatformNotification(title, options)

    if (notification && !options?.requireInteraction) {
      setTimeout(() => notification.close(), 5000)
    }

    return notification
  } catch (error) {
    console.error('Failed to show notification:', error)
    return null
  }
}

export function closeNotification(tag?: string): void {
  void closePlatformNotifications(tag)
}

export async function notifyNewMessage(
  senderName: string,
  messagePreview: string,
): Promise<NotificationLike | null> {
  return showNotification(`消息来自 ${senderName}`, {
    body: messagePreview,
    tag: 'new-message',
    data: { type: 'message' },
  })
}

export async function notifyIncomingCall(
  callerName: string,
  callType: 'voice' | 'video',
): Promise<NotificationLike | null> {
  const title = callType === 'video' ? `${callerName} 来视频通话` : `${callerName} 来电`

  return showNotification(title, {
    tag: 'incoming-call',
    requireInteraction: true,
    data: { type: 'call', callType },
  })
}

export async function notifyUnreadMessages(count: number): Promise<NotificationLike | null> {
  return showNotification('未读消息', {
    body: `你有 ${count} 条未读消息`,
    tag: 'unread-count',
    data: { type: 'unread', count },
  })
}

export function onNotificationClick(
  callback: (notification: NotificationLike) => void,
): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {}
  }

  const messageHandler = (event: MessageEvent<{ type?: string; notification?: NotificationLike }>) => {
    if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.notification) {
      callback(event.data.notification)
    }
  }

  navigator.serviceWorker.addEventListener('message', messageHandler)
  return () => {
    navigator.serviceWorker.removeEventListener('message', messageHandler)
  }
}

export async function playNotificationSound(_soundFile?: string): Promise<void> {
  try {
    void _soundFile
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextCtor) return

    const audioContext = new AudioContextCtor()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.connect(gain)
    gain.connect(audioContext.destination)

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

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'default'> {
  return getPlatformNotificationPermissionStatus()
}

export function closeAllNotifications(tag?: string): void {
  void closePlatformNotifications(tag)
}
