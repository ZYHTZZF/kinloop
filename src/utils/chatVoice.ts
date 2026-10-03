export type VoiceRecordingSession = {
  chunks: Blob[]
  mediaRecorder: MediaRecorder
  mimeType: string
  startedAt: number
  stream: MediaStream
}

const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

export async function startVoiceRecording(): Promise<VoiceRecordingSession> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('当前浏览器不支持录音')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = AUDIO_MIME_TYPES.find((item) => MediaRecorder.isTypeSupported(item)) ?? ''
  const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  const chunks: Blob[] = []

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data)
    }
  }

  mediaRecorder.start()

  return {
    chunks,
    mediaRecorder,
    mimeType: mimeType || mediaRecorder.mimeType || 'audio/webm',
    startedAt: Date.now(),
    stream,
  }
}

export function stopVoiceRecording(session: VoiceRecordingSession) {
  return new Promise<{ blob: Blob; durationMs: number }>((resolve, reject) => {
    const finalize = () => {
      session.stream.getTracks().forEach((track) => track.stop())
    }

    session.mediaRecorder.onstop = () => {
      const blob = new Blob(session.chunks, { type: session.mimeType })
      finalize()
      resolve({
        blob,
        durationMs: Date.now() - session.startedAt,
      })
    }

    session.mediaRecorder.onerror = () => {
      finalize()
      reject(new Error('语音录制失败'))
    }

    session.mediaRecorder.stop()
  })
}

export function cancelVoiceRecording(session: VoiceRecordingSession) {
  session.stream.getTracks().forEach((track) => track.stop())
  if (session.mediaRecorder.state !== 'inactive') {
    session.mediaRecorder.stop()
  }
}

export function readVoiceBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('语音读取失败'))
    }

    reader.onerror = () => reject(new Error('语音读取失败'))
    reader.readAsDataURL(blob)
  })
}

export function formatVoiceDuration(durationSec: number | null | undefined) {
  const totalSeconds = Math.max(0, Math.round(durationSec ?? 0))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatVoiceDurationMs(durationMs: number) {
  return formatVoiceDuration(durationMs / 1000)
}

export function getPlayableVoiceUrl(mediaUrl: string | null | undefined) {
  if (!mediaUrl) {
    return null
  }

  if (mediaUrl.startsWith('data:audio/') || mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    return mediaUrl
  }

  return null
}
