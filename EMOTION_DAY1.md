# Emotion Day1 Delivery

## Mapping Frozen (No Message Schema Change)

- `text_emotion` -> `pulses`
  - `source_type`: `AI`
  - `pulse_type`: `Emotion`
  - `severity`: `LOW|MEDIUM|HIGH` by score
  - `summary`: `文本情绪识别：{label}`
  - `source_conversation_id`: conversation id
- `face_emotion` -> `pulses`
  - `source_type`: `AI`
  - `pulse_type`: `Emotion`
  - `severity`: `LOW|MEDIUM|HIGH` by score
  - `summary`: `表情识别：{label}`
  - `source_conversation_id`: conversation id
- `voice_tone_emotion` -> `pulses`
  - `source_type`: `AI`
  - `pulse_type`: `Emotion`
  - `severity`: `LOW|MEDIUM|HIGH` by score
  - `summary`: `语气识别：{label}`
  - `source_conversation_id`: conversation id

## Unified Provider Result

```ts
type EmotionResult = {
  source: 'text' | 'face' | 'voice_tone' | 'text_fallback'
  label: 'positive' | 'neutral' | 'negative' | 'anxious' | 'sad' | 'angry' | 'calm'
  score: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  summary: string
  raw?: unknown
}
```

## Thresholds and Fallback

- `score < 0.50` -> `LOW`
- `0.50 <= score < 0.75` -> `MEDIUM`
- `score >= 0.75` -> `HIGH`
- `voice_tone` failed -> fallback to text emotion by `transcript` then `text`
- Any provider failed: message flow is not blocked; fallback low summary is produced

## Error Codes and Timeout

- `EMOTION_PROVIDER_TIMEOUT`
- `EMOTION_PROVIDER_UNAVAILABLE`
- `EMOTION_INVALID_INPUT`
- `EMOTION_NO_FACE_DETECTED`
- `EMOTION_MULTI_FACE_AMBIGUOUS`
- Provider timeout: 3s, retry once with exponential backoff

## New API

- `POST /api/emotions/analyze`
  - Request: `conversationId`, optional `familySpaceId`, and any of `text|imageUrl|audioUrl|transcript`
  - Response: normalized `results`, created `pulses`, and `errors`

## Real Provider Configuration

### Text (Baidu conversation emotion)

- `KINLOOP_EMOTION_TEXT_PROVIDER=baidu`
- `KINLOOP_EMOTION_TEXT_API_KEY=<baidu_api_key>`
- `KINLOOP_EMOTION_TEXT_SECRET_KEY=<baidu_secret_key>`
- Endpoint (built-in): `https://aip.baidubce.com/rpc/2.0/nlp/v1/emotion`

### Face (Baidu face emotion)

- `KINLOOP_EMOTION_FACE_PROVIDER=baidu`
- `KINLOOP_EMOTION_FACE_API_KEY=<baidu_api_key>`
- `KINLOOP_EMOTION_FACE_SECRET_KEY=<baidu_secret_key>`

### Voice tone (Hume prosody)

- `KINLOOP_EMOTION_VOICE_TONE_PROVIDER=hume`
- `KINLOOP_EMOTION_VOICE_TONE_API_KEY=<hume_api_key>`

If any key is missing, the service auto-falls back to mock providers.

## Quick Smoke Test

```bash
curl -X POST http://127.0.0.1:8787/api/emotions/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId":"conv_daughter",
    "text":"今天心情不错",
    "imageUrl":"https://example.com/face.jpg",
    "audioUrl":"https://example.com/audio.wav",
    "transcript":"我今天挺平静的"
  }'
```
