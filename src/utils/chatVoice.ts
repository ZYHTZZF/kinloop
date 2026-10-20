export type VoiceRecordingSession = {
  audioContext: AudioContext | null
  chunks: Blob[]
  mediaRecorder: MediaRecorder | null
  mimeType: string
  pcmChunks: Float32Array[]
  processorNode: ScriptProcessorNode | null
  sourceNode: MediaStreamAudioSourceNode | null
  startedAt: number
  stream: MediaStream
  silentGainNode: GainNode | null
}

const AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

export async function startVoiceRecording(): Promise<VoiceRecordingSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前设备暂时无法录音，请稍后再试。')
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

  if (typeof AudioContext !== 'undefined') {
    const audioContext = new AudioContext()
    const sourceNode = audioContext.createMediaStreamSource(stream)
    const processorNode = audioContext.createScriptProcessor(4096, 1, 1)
    const silentGainNode = audioContext.createGain()
    silentGainNode.gain.value = 0

    const pcmChunks: Float32Array[] = []
    processorNode.onaudioprocess = (event) => {
      const inputChannel = event.inputBuffer.getChannelData(0)
      pcmChunks.push(new Float32Array(inputChannel))
    }

    sourceNode.connect(processorNode)
    processorNode.connect(silentGainNode)
    silentGainNode.connect(audioContext.destination)

    return {
      audioContext,
      chunks: [],
      mediaRecorder: null,
      mimeType: 'audio/wav',
      pcmChunks,
      processorNode,
      sourceNode,
      startedAt: Date.now(),
      stream,
      silentGainNode,
    }
  }

  if (typeof MediaRecorder === 'undefined') {
    stream.getTracks().forEach((track) => track.stop())
    throw new Error('当前设备暂时无法录音，请稍后再试。')
  }

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
    audioContext: null,
    chunks,
    mediaRecorder,
    mimeType: mimeType || mediaRecorder.mimeType || 'audio/webm',
    pcmChunks: [],
    processorNode: null,
    sourceNode: null,
    startedAt: Date.now(),
    stream,
    silentGainNode: null,
  }
}

export function stopVoiceRecording(session: VoiceRecordingSession) {
  if (session.audioContext) {
    return stopWavRecording(session)
  }

  return stopMediaRecorderRecording(session)
}

async function stopWavRecording(session: VoiceRecordingSession) {
  detachAudioGraph(session)

  const blob = encodeWavBlob(session.pcmChunks, session.audioContext?.sampleRate ?? 44_100)
  await session.audioContext?.close()
  stopStream(session.stream)

  return {
    blob,
    durationMs: Date.now() - session.startedAt,
  }
}

function stopMediaRecorderRecording(session: VoiceRecordingSession) {
  return new Promise<{ blob: Blob; durationMs: number }>((resolve, reject) => {
    const finalize = () => {
      stopStream(session.stream)
    }

    if (!session.mediaRecorder) {
      finalize()
      reject(new Error('语音录制失败'))
      return
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
  if (session.audioContext) {
    detachAudioGraph(session)
    void session.audioContext.close()
    stopStream(session.stream)
    return
  }

  stopStream(session.stream)
  if (session.mediaRecorder && session.mediaRecorder.state !== 'inactive') {
    session.mediaRecorder.stop()
  }
}

function detachAudioGraph(session: VoiceRecordingSession) {
  session.processorNode?.disconnect()
  session.sourceNode?.disconnect()
  session.silentGainNode?.disconnect()
  if (session.processorNode) {
    session.processorNode.onaudioprocess = null
  }
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop())
}

function encodeWavBlob(chunks: Float32Array[], sampleRate: number) {
  const pcmData = mergePcmChunks(chunks)
  const wavBuffer = encodeWavBuffer(pcmData, sampleRate)
  return new Blob([wavBuffer], { type: 'audio/wav' })
}

function mergePcmChunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return merged
}

function encodeWavBuffer(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, samples.length * bytesPerSample, true)
  writePcmSamples(view, 44, samples)

  return buffer
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index))
  }
}

function writePcmSamples(view: DataView, offset: number, samples: Float32Array) {
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset + index * 2, int16, true)
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
