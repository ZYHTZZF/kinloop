import { INotificationOptions } from '../services/api/types'

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications')
    return false
  }

  if (Notification.permission === 'granted') return true

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

export function showNotification(
  title: string,
  options?: INotificationOptions,
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
      ...options,
    })

    if (!options?.requireInteraction) {
      setTimeout(() => notification.close(), 5000)
    }

    return notification
  } catch (error) {
    console.error('Failed to show notification:', error)
    return null
  }
}

export function closeNotification(tag?: string): void {
  if (!('Notification' in window)) return

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage({
      type: 'CLOSE_NOTIFICATION',
      tag,
    })
  }
}

export function notifyNewMessage(
  senderName: string,
  messagePreview: string,
): Notification | null {
  return showNotification(`消息来自 ${senderName}`, {
    body: messagePreview,
    tag: 'new-message',
    data: { type: 'message' },
  })
}

export function notifyIncomingCall(
  callerName: string,
  callType: 'voice' | 'video',
): Notification | null {
  const title = callType === 'video' ? `${callerName} 来视频通话` : `${callerName} 来电`

  return showNotification(title, {
    tag: 'incoming-call',
    requireInteraction: true,
    data: { type: 'call', callType },
  })
}

export function notifyUnreadMessages(count: number): Notification | null {
  return showNotification('未读消息', {
    body: `你有 ${count} 条未读消息`,
    tag: 'unread-count',
    data: { type: 'unread', count },
  })
}

export function onNotificationClick(
  callback: (notification: Notification) => void,
): () => void {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return () => {}
  }

  const messageHandler = (event: MessageEvent<{ type?: string; notification?: Notification }>) => {
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
  return 'Notification' in window
}

export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission as 'granted' | 'denied' | 'default'
}

export function closeAllNotifications(tag?: string): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLOSE_ALL_NOTIFICATIONS',
      tag,
    })
  }
}
