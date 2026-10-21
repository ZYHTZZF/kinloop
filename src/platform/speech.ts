import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

type SpeechRecognitionResultLike = {
  0: { transcript: string }
  isFinal: boolean
  length: number
}

type SpeechRecognitionEventLike = Event & {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type BrowserSpeechRecognition = EventTarget & {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event & { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition

export interface SpeechSession {
  stop: () => Promise<void>
}

export interface StartSpeechRecognitionOptions {
  language?: string
  onPartialResult?: (text: string) => void
  onFinalResult?: (text: string) => void
  onError?: (message: string) => void
  onListeningStateChange?: (listening: boolean) => void
}

export interface SpeechRecognitionSupportStatus {
  supported: boolean
  reason:
    | 'available'
    | 'native-unavailable'
    | 'native-error'
    | 'browser-unsupported'
    | 'browser-insecure-context'
    | 'browser-mic-unavailable'
}

function getBrowserSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null

  const win = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionCtor
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor
  }

  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null
}

export async function getSpeechRecognitionSupportStatus(): Promise<SpeechRecognitionSupportStatus> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { available } = await SpeechRecognition.available()
      return {
        supported: available,
        reason: available ? 'available' : 'native-unavailable',
      }
    } catch {
      return {
        supported: false,
        reason: 'native-error',
      }
    }
  }

  if (typeof window === 'undefined') {
    return {
      supported: false,
      reason: 'browser-unsupported',
    }
  }

  const host = window.location.hostname
  if (!window.isSecureContext && host !== 'localhost' && host !== '127.0.0.1') {
    return {
      supported: false,
      reason: 'browser-insecure-context',
    }
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      supported: false,
      reason: 'browser-mic-unavailable',
    }
  }

  return {
    supported: getBrowserSpeechRecognitionCtor() !== null,
    reason: getBrowserSpeechRecognitionCtor() !== null ? 'available' : 'browser-unsupported',
  }
}

export async function isSpeechRecognitionSupported() {
  const status = await getSpeechRecognitionSupportStatus()
  return status.supported
}

export async function startSpeechRecognition(
  options: StartSpeechRecognitionOptions = {},
): Promise<SpeechSession | null> {
  if (Capacitor.isNativePlatform()) {
    return startNativeSpeechRecognition(options)
  }

  return startBrowserSpeechRecognition(options)
}

async function startNativeSpeechRecognition(
  options: StartSpeechRecognitionOptions,
): Promise<SpeechSession | null> {
  const { available } = await SpeechRecognition.available()
  if (!available) return null

  let latestTranscript = ''
  const handles: PluginListenerHandle[] = []

  handles.push(
    await SpeechRecognition.addListener('partialResults', ({ matches }) => {
      latestTranscript = (matches ?? []).join(' ').trim()
      if (latestTranscript) {
        options.onPartialResult?.(latestTranscript)
      }
    }),
  )

  handles.push(
    await SpeechRecognition.addListener('listeningState', ({ status }) => {
      options.onListeningStateChange?.(status === 'started')
      if (status === 'stopped' && latestTranscript) {
        options.onFinalResult?.(latestTranscript)
      }
    }),
  )

  try {
    const result = await SpeechRecognition.start({
      language: options.language ?? 'zh-CN',
      maxResults: 1,
      partialResults: true,
      popup: false,
      prompt: '请说话',
    })

    const matches = (result.matches ?? []).join(' ').trim()
    if (matches) {
      latestTranscript = matches
      options.onPartialResult?.(matches)
      options.onFinalResult?.(matches)
    }
  } catch (error) {
    await cleanupNativeSpeechListeners(handles)
    options.onError?.(error instanceof Error ? error.message : '原生语音识别启动失败')
    return null
  }

  return {
    stop: async () => {
      try {
        await SpeechRecognition.stop()
      } finally {
        if (latestTranscript) {
          options.onFinalResult?.(latestTranscript)
        }
        await cleanupNativeSpeechListeners(handles)
      }
    },
  }
}

function startBrowserSpeechRecognition(
  options: StartSpeechRecognitionOptions,
): Promise<SpeechSession | null> {
  const speechRecognitionCtor = getBrowserSpeechRecognitionCtor()
  if (!speechRecognitionCtor) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    let finalText = ''
    let stopped = false
    const recognition = new speechRecognitionCtor()
    recognition.lang = options.language ?? 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let nextFinal = finalText
      let interimText = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result?.[0]?.transcript ?? ''
        if (result?.isFinal) {
          nextFinal += transcript
        } else {
          interimText += transcript
        }
      }

      finalText = nextFinal
      const liveText = `${nextFinal}${interimText}`.trim()
      if (liveText) {
        options.onPartialResult?.(liveText)
      }
    }
    recognition.onerror = (event) => {
      const errorCode = event.error ?? 'unknown'
      if (errorCode !== 'no-speech') {
        options.onError?.(errorCode)
      }
    }
    recognition.onend = () => {
      options.onListeningStateChange?.(false)
      const transcript = finalText.trim()
      if (transcript) {
        options.onFinalResult?.(transcript)
      }
    }

    try {
      recognition.start()
      options.onListeningStateChange?.(true)
      resolve({
        stop: async () => {
          if (stopped) return
          stopped = true
          recognition.stop()
        },
      })
    } catch (error) {
      options.onError?.(error instanceof Error ? error.message : '浏览器语音识别启动失败')
      resolve(null)
    }
  })
}

async function cleanupNativeSpeechListeners(handles: PluginListenerHandle[]) {
  await Promise.allSettled(handles.map((handle) => handle.remove()))
}
