import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { SpeechRecognition } from '@capacitor-community/speech-recognition'
import { transcribeRecordedAudio } from '../services/api/asrApi'

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
  autoStopAfterSilenceMs?: number
  maxRecordingMs?: number
}

interface AudioCaptureSession {
  mediaStream: MediaStream
  recorder: MediaRecorder
  chunks: Blob[]
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

export async function startRecordedSpeechRecognition(
  options: StartSpeechRecognitionOptions = {},
): Promise<SpeechSession | null> {
  if (typeof window === 'undefined') return null
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    return null
  }

  let session: AudioCaptureSession | null = null
  let stopPromise: Promise<void> | null = null
  let stopMonitor: (() => Promise<void>) | null = null

  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    })

    const mimeType = resolveRecorderMimeType()
    const recorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType })
      : new MediaRecorder(mediaStream)

    const chunks: Blob[] = []
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data)
      }
    })

    session = { mediaStream, recorder, chunks }
    recorder.start(250)
    options.onListeningStateChange?.(true)

    if (options.autoStopAfterSilenceMs && options.autoStopAfterSilenceMs > 0) {
      stopMonitor = startSilenceAutoStopMonitor(mediaStream, {
        silenceMs: options.autoStopAfterSilenceMs,
        maxRecordingMs: options.maxRecordingMs,
        onSilence: () => {
          void stopSession()
        },
      })
    }
  } catch (error) {
    options.onError?.(error instanceof Error ? error.message : '麦克风启动失败')
    stopAudioCaptureSession(session)
    await stopMonitor?.()
    return null
  }

  const stopSession = async () => {
    if (stopPromise) {
      await stopPromise
      return
    }

    stopPromise = (async () => {
      if (!session) return
      const finishedSession = session
      session = null

      try {
        await stopMonitor?.()
        const audioBlob = await stopAndCollectRecording(finishedSession)
        const wavBlob = await convertBlobToWav(audioBlob)
        const result = await transcribeRecordedAudioWithRetry(wavBlob)
        const text = String(result.text ?? '').trim()

        if (text) {
          options.onFinalResult?.(text)
        } else {
          options.onError?.('刚才没有识别到清晰内容')
        }
      } catch (error) {
        options.onError?.(error instanceof Error ? error.message : '语音转写失败')
      } finally {
        options.onListeningStateChange?.(false)
      }
    })()

    await stopPromise
  }

  return {
    stop: stopSession,
  }

  return {
    stop: async () => {
      if (!session) return
      const finishedSession = session
      session = null

      try {
        const audioBlob = await stopAndCollectRecording(finishedSession)
        const wavBlob = await convertBlobToWav(audioBlob)
        const result = await transcribeRecordedAudio(wavBlob)
        const text = String(result.text ?? '').trim()

        if (text) {
          options.onFinalResult?.(text)
        } else {
          options.onError?.('刚才没有识别到清晰内容')
        }
      } catch (error) {
        options.onError?.(error instanceof Error ? error.message : '语音转写失败')
      } finally {
        options.onListeningStateChange?.(false)
      }
    },
  }
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
    let heardSpeech = false
    let silenceTimer: number | null = null
    let maxTimer: number | null = null
    let initialTimer: number | null = null
    const recognition = new speechRecognitionCtor()
    recognition.lang = options.language ?? 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true

    const clearSilenceTimer = () => {
      if (silenceTimer !== null) {
        window.clearTimeout(silenceTimer)
        silenceTimer = null
      }
    }

    const stopRecognition = () => {
      if (stopped) return
      stopped = true
      clearSilenceTimer()
      if (initialTimer !== null) {
        window.clearTimeout(initialTimer)
        initialTimer = null
      }
      if (maxTimer !== null) {
        window.clearTimeout(maxTimer)
        maxTimer = null
      }
      recognition.stop()
    }

    const scheduleSilenceStop = () => {
      if (!options.autoStopAfterSilenceMs || !heardSpeech) return
      clearSilenceTimer()
      silenceTimer = window.setTimeout(() => {
        stopRecognition()
      }, options.autoStopAfterSilenceMs)
    }

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
        heardSpeech = true
        if (initialTimer !== null) {
          window.clearTimeout(initialTimer)
          initialTimer = null
        }
        scheduleSilenceStop()
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
      clearSilenceTimer()
      if (initialTimer !== null) {
        window.clearTimeout(initialTimer)
        initialTimer = null
      }
      if (maxTimer !== null) {
        window.clearTimeout(maxTimer)
        maxTimer = null
      }
      options.onListeningStateChange?.(false)
      const transcript = finalText.trim()
      if (transcript) {
        options.onFinalResult?.(transcript)
      }
    }

    try {
      recognition.start()
      options.onListeningStateChange?.(true)
      const initialTimeoutMs = Math.min(options.maxRecordingMs ?? 12000, 5000)
      initialTimer = window.setTimeout(() => {
        stopRecognition()
      }, initialTimeoutMs)
      if (options.maxRecordingMs) {
        maxTimer = window.setTimeout(() => {
          stopRecognition()
        }, options.maxRecordingMs)
      }
      resolve({
        stop: async () => {
          stopRecognition()
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

function resolveRecorderMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]

  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }

  return ''
}

function stopAndCollectRecording(session: AudioCaptureSession) {
  return new Promise<Blob>((resolve, reject) => {
    const { recorder, chunks } = session
    let settled = false

    const cleanup = () => {
      stopAudioCaptureSession(session)
      recorder.removeEventListener('stop', handleStop)
      recorder.removeEventListener('error', handleError)
    }

    const handleStop = () => {
      if (settled) return
      settled = true
      const fallbackType = recorder.mimeType || chunks[0]?.type || 'audio/webm'
      const blob = new Blob(chunks, { type: fallbackType })
      cleanup()
      resolve(blob)
    }

    const handleError = (event: Event) => {
      if (settled) return
      settled = true
      cleanup()
      const mediaError = event as Event & { error?: Error }
      reject(mediaError.error ?? new Error('录音停止失败'))
    }

    recorder.addEventListener('stop', handleStop)
    recorder.addEventListener('error', handleError)

    if (recorder.state === 'inactive') {
      handleStop()
      return
    }

    recorder.stop()
  })
}

function stopAudioCaptureSession(session: AudioCaptureSession | null) {
  session?.mediaStream.getTracks().forEach((track) => track.stop())
}

function startSilenceAutoStopMonitor(
  mediaStream: MediaStream,
  options: {
    silenceMs: number
    maxRecordingMs?: number
    onSilence: () => void
  },
) {
  const speechRmsThreshold = 0.012
  const initialSpeechTimeoutMs = Math.min(options.maxRecordingMs ?? 12000, 5000)
  const AudioContextCtor = window.AudioContext
    || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextCtor) {
    return async () => {}
  }

  const audioContext = new AudioContextCtor()
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.85

  const source = audioContext.createMediaStreamSource(mediaStream)
  source.connect(analyser)

  const data = new Uint8Array(analyser.fftSize)
  const startedAt = Date.now()
  let lastSpeechAt = startedAt
  let heardSpeech = false
  let stopped = false

  void audioContext.resume().catch(() => {})

  const timer = window.setInterval(() => {
    if (stopped) return

    analyser.getByteTimeDomainData(data)
    let energy = 0

    for (let index = 0; index < data.length; index += 1) {
      const sample = (data[index] - 128) / 128
      energy += sample * sample
    }

    const rms = Math.sqrt(energy / data.length)
    const now = Date.now()

    if (rms >= speechRmsThreshold) {
      heardSpeech = true
      lastSpeechAt = now
      return
    }

    if (heardSpeech && now - lastSpeechAt >= options.silenceMs) {
      stopped = true
      window.clearInterval(timer)
      options.onSilence()
      return
    }

    if (!heardSpeech && now - startedAt >= initialSpeechTimeoutMs) {
      stopped = true
      window.clearInterval(timer)
      options.onSilence()
      return
    }

    if (options.maxRecordingMs && now - startedAt >= options.maxRecordingMs) {
      stopped = true
      window.clearInterval(timer)
      options.onSilence()
    }
  }, 120)

  return async () => {
    window.clearInterval(timer)
    if (stopped) return
    stopped = true
    source.disconnect()
    analyser.disconnect()
    await audioContext.close().catch(() => {})
  }
}

async function convertBlobToWav(sourceBlob: Blob) {
  const audioBuffer = await decodeAudioBlob(sourceBlob)
  const monoData = mergeToMono(audioBuffer)
  const targetSampleRate = 16000
  const resampled = audioBuffer.sampleRate === targetSampleRate
    ? monoData
    : resamplePcm(monoData, audioBuffer.sampleRate, targetSampleRate)
  return encodeWavBlob(resampled, targetSampleRate)
}

async function transcribeRecordedAudioWithRetry(audioBlob: Blob, retries = 1) {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await transcribeRecordedAudio(audioBlob)
    } catch (error) {
      lastError = error
      if (attempt >= retries) {
        break
      }
      await new Promise((resolve) => window.setTimeout(resolve, 260))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('ASR transcribe failed')
}

async function decodeAudioBlob(sourceBlob: Blob) {
  const arrayBuffer = await sourceBlob.arrayBuffer()
  const audioContext = new AudioContext()

  try {
    return await audioContext.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await audioContext.close()
  }
}

function mergeToMono(audioBuffer: AudioBuffer) {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0)
  }

  const frameCount = audioBuffer.length
  const output = new Float32Array(frameCount)

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel)
    for (let index = 0; index < frameCount; index += 1) {
      output[index] += channelData[index] / audioBuffer.numberOfChannels
    }
  }

  return output
}

function resamplePcm(source: Float32Array, sourceRate: number, targetRate: number) {
  if (sourceRate === targetRate) {
    return source
  }

  const sampleRatio = sourceRate / targetRate
  const targetLength = Math.max(1, Math.round(source.length / sampleRatio))
  const result = new Float32Array(targetLength)

  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = index * sampleRatio
    const leftIndex = Math.floor(sourceIndex)
    const rightIndex = Math.min(leftIndex + 1, source.length - 1)
    const weight = sourceIndex - leftIndex
    result[index] = source[leftIndex] * (1 - weight) + source[rightIndex] * weight
  }

  return result
}

function encodeWavBlob(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2
  const headerSize = 44
  const buffer = new ArrayBuffer(headerSize + samples.length * bytesPerSample)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, samples.length * bytesPerSample, true)

  let offset = headerSize
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}
