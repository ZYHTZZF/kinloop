import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { INotificationOptions } from '../services/api/types'

export type NotificationLike =
  | Notification
  | {
      title: string
      body?: string
      tag?: string
      data?: unknown
      close: () => void
    }

let nativeNotificationId = 1000

function nextNativeNotificationId() {
  nativeNotificationId += 1
  return nativeNotificationId
}

export async function showPlatformNotification(
  title: string,
  options?: INotificationOptions,
): Promise<NotificationLike | null> {
  if (Capacitor.isNativePlatform()) {
    const id = nextNativeNotificationId()
    const body = options?.body ?? ''

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          largeBody: body || undefined,
          extra: options?.data,
          schedule: { at: new Date(Date.now() + 250) },
        },
      ],
    })

    return {
      title,
      body: body || undefined,
      tag: options?.tag,
      data: options?.data,
      close: () => {
        void LocalNotifications.cancel({ notifications: [{ id }] })
      },
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null
  }

  if (Notification.permission !== 'granted') {
    return null
  }

  return new Notification(title, {
    icon: '/icons/logo.png',
    badge: '/icons/badge.png',
    ...options,
  })
}

export async function closePlatformNotifications(tag?: string) {
  void tag

  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.removeAllDeliveredNotifications()
    return
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage({
      type: 'CLOSE_ALL_NOTIFICATIONS',
    })
  }
}
