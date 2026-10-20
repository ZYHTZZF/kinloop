import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { LocalNotifications } from '@capacitor/local-notifications'

export async function ensureSpeechRecognitionPermission() {
  if (Capacitor.isNativePlatform()) {
    const current = await SpeechRecognition.checkPermissions()
    if (current.speechRecognition === 'granted') {
      return true
    }

    const requested = await SpeechRecognition.requestPermissions()
    return requested.speechRecognition === 'granted'
  }

  if (typeof window === 'undefined') return false

  const host = window.location.hostname
  if (!window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1') {
    return false
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return false
  }

  try {
    const permissionApi = navigator.permissions as Permissions | undefined
    if (permissionApi?.query) {
      const status = await permissionApi.query({ name: 'microphone' as PermissionName })
      if (status.state === 'denied') {
        return false
      }
    }
  } catch {
    // ignore browser differences
  }

  return true
}

export async function ensureMicrophoneCapturePermission() {
  if (typeof window === 'undefined') return false

  const host = window.location.hostname
  if (!window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1') {
    return false
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return false
  }

  try {
    const permissionApi = navigator.permissions as Permissions | undefined
    if (permissionApi?.query) {
      const status = await permissionApi.query({ name: 'microphone' as PermissionName })
      if (status.state === 'denied') {
        return false
      }
    }
  } catch {
    // ignore browser differences
  }

  return true
}

export async function ensureCallMediaPermission(callType: 'voice' | 'video') {
  if (typeof window === 'undefined') return false

  const host = window.location.hostname
  if (!window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1') {
    return false
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return false
  }

  const constraints: MediaStreamConstraints =
    callType === 'video'
      ? { audio: true, video: true }
      : { audio: true, video: false }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    return false
  }
}

export async function ensureNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') {
      return true
    }

    const requested = await LocalNotifications.requestPermissions()
    return requested.display === 'granted'
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'default'> {
  if (Capacitor.isNativePlatform()) {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') return 'granted'
    if (current.display === 'denied') return 'denied'
    return 'default'
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }

  return Notification.permission as 'granted' | 'denied' | 'default'
}
