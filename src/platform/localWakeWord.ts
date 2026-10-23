import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export interface LocalWakeWordSession {
  stop: () => Promise<void>
}

type LocalWakeWordPlugin = {
  isAvailable: () => Promise<{ available: boolean }>
  start: (options?: { keywordSpec?: string }) => Promise<{ status: string }>
  stop: () => Promise<{ status: string }>
  speak: (options?: { text?: string }) => Promise<{ status: string }>
  addListener(
    eventName: 'wakeWordDetected',
    listenerFunc: (event: { keyword?: string }) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'wakeWordStatus',
    listenerFunc: (event: { status?: string }) => void,
  ): Promise<PluginListenerHandle>
}

const LocalWakeWord = registerPlugin<LocalWakeWordPlugin>('LocalWakeWord')

export async function isLocalWakeWordAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false

  try {
    const result = await LocalWakeWord.isAvailable()
    return result.available
  } catch {
    return false
  }
}

export async function startLocalWakeWordListening(options: {
  keywordSpec?: string
  onDetected: (keyword: string) => void
  onStatus?: (status: string) => void
}): Promise<LocalWakeWordSession> {
  const detectedListener = await LocalWakeWord.addListener('wakeWordDetected', (event) => {
    options.onDetected(event.keyword?.trim() || '\u5c0f\u667a\u5c0f\u667a')
  })
  const statusListener = await LocalWakeWord.addListener('wakeWordStatus', (event) => {
    if (event.status) {
      options.onStatus?.(event.status)
    }
  })

  try {
    await LocalWakeWord.start({ keywordSpec: options.keywordSpec })
  } catch (error) {
    await detectedListener.remove()
    await statusListener.remove()
    throw error
  }

  return {
    stop: async () => {
      try {
        await LocalWakeWord.stop()
      } finally {
        await detectedListener.remove()
        await statusListener.remove()
      }
    },
  }
}

export async function speakNativeWakeReply(text = '\u6211\u5728'): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false

  try {
    await LocalWakeWord.speak({ text })
    return true
  } catch {
    return false
  }
}
