import { randomUUID } from 'node:crypto'
import tencentCloudSdk from 'tencentcloud-sdk-nodejs-tts'
import {
  TENCENT_TTS_ENDPOINT,
  TENCENT_TTS_REGION,
  TENCENT_TTS_SECRET_ID,
  TENCENT_TTS_SECRET_KEY,
  TENCENT_TTS_VOICE_TYPE,
} from '../config.mjs'

const TtsClient = tencentCloudSdk.tts.v20190823.Client

let ttsClient = null

function getTencentTtsClient() {
  if (!TENCENT_TTS_SECRET_ID || !TENCENT_TTS_SECRET_KEY) {
    return null
  }

  if (!ttsClient) {
    ttsClient = new TtsClient({
      credential: {
        secretId: TENCENT_TTS_SECRET_ID,
        secretKey: TENCENT_TTS_SECRET_KEY,
      },
      region: TENCENT_TTS_REGION,
      profile: {
        httpProfile: {
          endpoint: TENCENT_TTS_ENDPOINT,
        },
      },
    })
  }

  return ttsClient
}

export function registerTtsRoutes(app) {
  app.post('/api/tts/synthesize', async (request, response) => {
    const text = `${request.body?.text ?? ''}`.trim()
    const voiceType = Number(request.body?.voiceType ?? TENCENT_TTS_VOICE_TYPE)
    const client = getTencentTtsClient()

    if (!text) {
      response.status(400).json({ error: 'text is required' })
      return
    }

    if (!client) {
      response.status(503).json({
        error: 'Tencent Cloud TTS is not configured on the server.',
      })
      return
    }

    try {
      const result = await client.TextToVoice({
        Text: text,
        SessionId: `kinloop-${randomUUID()}`,
        ModelType: 1,
        VoiceType: Number.isFinite(voiceType) ? voiceType : TENCENT_TTS_VOICE_TYPE,
        PrimaryLanguage: 1,
        SampleRate: 16000,
        Codec: 'mp3',
      })

      if (!result?.Audio) {
        response.status(502).json({ error: 'Tencent Cloud TTS returned an empty audio payload.' })
        return
      }

      response.json({
        audioBase64: result.Audio,
        mimeType: 'audio/mpeg',
        provider: 'tencentcloud',
        voiceType: Number.isFinite(voiceType) ? voiceType : TENCENT_TTS_VOICE_TYPE,
      })
    } catch (error) {
      response.status(502).json({
        error: error instanceof Error ? error.message : 'Tencent Cloud TTS request failed',
      })
    }
  })
}
