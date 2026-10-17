import { useCallback, useEffect, useRef } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { createVideoCallEmotionSummary } from '../../services/api'
import type { VideoCallEmotionSample } from '../../services/api'

const FACE_SAMPLE_INTERVAL_MS = 20_000
const FACE_SAMPLE_INITIAL_DELAY_MS = 4_000
const MEDIAPIPE_WASM_ROOT = '/mediapipe/wasm'
const FACE_LANDMARKER_MODEL_URL = '/mediapipe/models/face_landmarker.task'

let faceLandmarkerPromise: Promise<FaceLandmarker | null> | null = null

type UseVideoCallEmotionSummaryOptions = {
  enabled: boolean
  conversationId: string | null
  familySpaceId: string | null
  targetVideoStream: MediaStream | null
  shouldSubmit: boolean
}

type EmotionSession = {
  callId: string
  startedAt: number
  faceSamples: VideoCallEmotionSample[]
  voiceSamples: VideoCallEmotionSample[]
}

async function getFaceLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT)
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: FACE_LANDMARKER_MODEL_URL,
          },
          runningMode: 'VIDEO',
          outputFaceBlendshapes: true,
          numFaces: 2,
        })
      } catch (error) {
        console.warn('[VideoCallEmotion] Failed to initialize MediaPipe Face Landmarker:', error)
        return null
      }
    })()
  }

  return faceLandmarkerPromise
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getCategoryScore(categories: Array<{ categoryName?: string; score?: number }>, names: string[]) {
  const matched = categories
    .filter((category) => names.includes(`${category.categoryName ?? ''}`))
    .map((category) => Number(category.score ?? 0))

  return matched.length > 0 ? average(matched) : 0
}

function mapBlendshapesToSample(
  categories: Array<{ categoryName?: string; score?: number }>,
): VideoCallEmotionSample {
  const smileScore = getCategoryScore(categories, ['mouthSmileLeft', 'mouthSmileRight'])
  const sadScore = Math.max(
    getCategoryScore(categories, ['mouthFrownLeft', 'mouthFrownRight']),
    getCategoryScore(categories, ['lipCornerDepressorLeft', 'lipCornerDepressorRight']),
    average([
      getCategoryScore(categories, ['browInnerUp']),
      getCategoryScore(categories, ['mouthPressLeft', 'mouthPressRight']),
    ]),
  )
  const anxiousScore = Math.max(
    average([
      getCategoryScore(categories, ['eyeWideOpenLeft', 'eyeWideOpenRight']),
      getCategoryScore(categories, ['browInnerUp']),
    ]),
    average([
      getCategoryScore(categories, ['mouthStretchLeft', 'mouthStretchRight']),
      getCategoryScore(categories, ['jawOpen']),
    ]),
  )

  if (smileScore >= 0.35 && smileScore > sadScore + 0.04 && smileScore > anxiousScore + 0.04) {
    return {
      timestamp: Date.now(),
      label: 'positive',
      score: smileScore,
      confidence: Math.max(0.55, smileScore),
    }
  }

  if (sadScore >= 0.24 && sadScore >= anxiousScore) {
    return {
      timestamp: Date.now(),
      label: 'sad',
      score: sadScore,
      confidence: Math.max(0.55, sadScore),
    }
  }

  if (anxiousScore >= 0.28) {
    return {
      timestamp: Date.now(),
      label: 'anxious',
      score: anxiousScore,
      confidence: Math.max(0.55, anxiousScore),
    }
  }

  if (smileScore < 0.12 && sadScore < 0.18 && anxiousScore < 0.18) {
    return {
      timestamp: Date.now(),
      label: 'calm',
      score: 0.6,
      confidence: 0.6,
    }
  }

  return {
    timestamp: Date.now(),
    label: 'neutral',
    score: 0.55,
    confidence: 0.55,
  }
}

export function useVideoCallEmotionSummary({
  enabled,
  conversationId,
  familySpaceId,
  targetVideoStream,
  shouldSubmit,
}: UseVideoCallEmotionSummaryOptions) {
  const sessionRef = useRef<EmotionSession | null>(null)
  const intervalRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureRunningRef = useRef(false)

  const stopSampling = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const video = hiddenVideoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
      hiddenVideoRef.current = null
    }

    canvasRef.current = null
    captureRunningRef.current = false
  }, [])

  const captureFaceSample = useCallback(async () => {
    if (captureRunningRef.current) {
      return
    }

    const video = hiddenVideoRef.current
    if (!video || !sessionRef.current || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return
    }

    captureRunningRef.current = true
    try {
      const landmarker = await getFaceLandmarker()
      if (!landmarker) {
        return
      }

      const result = landmarker.detectForVideo(video, performance.now())
      const faceBlendshapes = Array.isArray(result.faceBlendshapes) ? result.faceBlendshapes : []
      if (faceBlendshapes.length !== 1) {
        return
      }

      const categories = Array.isArray(faceBlendshapes[0]?.categories) ? faceBlendshapes[0].categories : []
      const sample = mapBlendshapesToSample(categories)
      sessionRef.current.faceSamples.push(sample)
    } catch (error) {
      console.warn('[VideoCallEmotion] Face sample capture failed:', error)
    } finally {
      captureRunningRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || !targetVideoStream || typeof window === 'undefined') {
      stopSampling()
      return
    }

    if (!sessionRef.current) {
      sessionRef.current = {
        callId: `video-call-${Date.now()}`,
        startedAt: Date.now(),
        faceSamples: [],
        voiceSamples: [],
      }
    }

    const video = document.createElement('video')
    video.autoplay = true
    video.muted = true
    video.playsInline = true
    video.srcObject = targetVideoStream
    hiddenVideoRef.current = video
    canvasRef.current = document.createElement('canvas')

    const startSampling = async () => {
      try {
        await video.play()
      } catch (error) {
        console.warn('[VideoCallEmotion] Hidden video playback failed:', error)
      }

      timeoutRef.current = window.setTimeout(() => {
        void captureFaceSample()
      }, FACE_SAMPLE_INITIAL_DELAY_MS)
      intervalRef.current = window.setInterval(() => {
        void captureFaceSample()
      }, FACE_SAMPLE_INTERVAL_MS)
    }

    void startSampling()

    return () => {
      stopSampling()
    }
  }, [captureFaceSample, enabled, stopSampling, targetVideoStream])

  const finishSummary = useCallback(async (durationMs: number) => {
    stopSampling()

    const session = sessionRef.current
    sessionRef.current = null

    if (!shouldSubmit || !conversationId || !familySpaceId || !session) {
      return null
    }

    return createVideoCallEmotionSummary({
      conversationId,
      familySpaceId,
      callType: 'video',
      durationMs,
      targetRole: 'elder',
      faceSamples: session.faceSamples,
      voiceSamples: session.voiceSamples,
    })
  }, [conversationId, familySpaceId, shouldSubmit, stopSampling])

  return {
    finishSummary,
  }
}
