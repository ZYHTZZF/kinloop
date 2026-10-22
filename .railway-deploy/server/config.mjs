import { resolve } from 'node:path'
import { loadServerEnv } from './loadEnv.mjs'

loadServerEnv()

const DATA_DIR = process.env.KINLOOP_DATA_DIR
  ? resolve(process.cwd(), process.env.KINLOOP_DATA_DIR)
  : resolve(process.cwd(), 'data')

export const API_PORT = Number(process.env.PORT ?? process.env.KINLOOP_API_PORT ?? 8787)
export const API_HOST = process.env.KINLOOP_API_HOST ?? '0.0.0.0'
export const DB_PATH = process.env.KINLOOP_DB_PATH
  ? resolve(process.cwd(), process.env.KINLOOP_DB_PATH)
  : resolve(DATA_DIR, 'kinloop.db')
export const UPLOADS_DIR = process.env.KINLOOP_UPLOADS_DIR
  ? resolve(process.cwd(), process.env.KINLOOP_UPLOADS_DIR)
  : resolve(DATA_DIR, 'uploads')

// Volcano-related config
export const VOLCANO_API_KEY = process.env.KINLOOP_VOLCANO_API_KEY ?? ''
export const VOLCANO_ENDPOINT = 'https://api.volcanoapi.com'
export const VOLC_TTS_API_KEY = process.env.KINLOOP_VOLC_TTS_API_KEY ?? VOLCANO_API_KEY
export const VOLC_TTS_APP_ID = process.env.KINLOOP_VOLC_TTS_APP_ID ?? process.env.KINLOOP_VOLC_ASR_APP_ID ?? ''
export const VOLC_TTS_ACCESS_TOKEN = process.env.KINLOOP_VOLC_TTS_ACCESS_TOKEN ?? VOLC_TTS_API_KEY
export const VOLC_TTS_CLUSTER = process.env.KINLOOP_VOLC_TTS_CLUSTER ?? 'volcano_tts'
export const VOLC_TTS_VOICE_TYPE = process.env.KINLOOP_VOLC_TTS_VOICE_TYPE ?? 'BV700_streaming'
export const VOLC_TTS_ENDPOINT = process.env.KINLOOP_VOLC_TTS_ENDPOINT ?? 'https://openspeech.bytedance.com/api/v1/tts'
export const TENCENT_TTS_APP_ID = process.env.KINLOOP_TENCENT_TTS_APP_ID ?? ''
export const TENCENT_TTS_SECRET_ID = process.env.KINLOOP_TENCENT_TTS_SECRET_ID ?? ''
export const TENCENT_TTS_SECRET_KEY = process.env.KINLOOP_TENCENT_TTS_SECRET_KEY ?? ''
export const TENCENT_TTS_REGION = process.env.KINLOOP_TENCENT_TTS_REGION ?? 'ap-guangzhou'
export const TENCENT_TTS_ENDPOINT = process.env.KINLOOP_TENCENT_TTS_ENDPOINT ?? 'tts.tencentcloudapi.com'
export const TENCENT_TTS_VOICE_TYPE = Number(process.env.KINLOOP_TENCENT_TTS_VOICE_TYPE ?? 101001)
export const TENCENT_ASR_SECRET_ID = process.env.KINLOOP_TENCENT_ASR_SECRET_ID ?? TENCENT_TTS_SECRET_ID
export const TENCENT_ASR_SECRET_KEY = process.env.KINLOOP_TENCENT_ASR_SECRET_KEY ?? TENCENT_TTS_SECRET_KEY
export const TENCENT_ASR_REGION = process.env.KINLOOP_TENCENT_ASR_REGION ?? TENCENT_TTS_REGION
export const TENCENT_ASR_ENDPOINT = process.env.KINLOOP_TENCENT_ASR_ENDPOINT ?? 'asr.tencentcloudapi.com'
export const TENCENT_ASR_ENGINE_MODEL_TYPE = process.env.KINLOOP_TENCENT_ASR_ENGINE_MODEL_TYPE ?? '16k_zh'

// LLM intent parsing (OpenAI-compatible chat/completions endpoint)
export const LLM_API_KEY = process.env.KINLOOP_LLM_API_KEY ?? process.env.KINLOOP_VOLCANO_API_KEY ?? ''
export const LLM_BASE_URL = process.env.KINLOOP_LLM_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3'
export const LLM_MODEL = process.env.KINLOOP_LLM_MODEL ?? ''
export const SUGGESTION_FAST_MODEL = process.env.KINLOOP_SUGGESTION_FAST_MODEL ?? LLM_MODEL
export const SUGGESTION_STRONG_MODEL = process.env.KINLOOP_SUGGESTION_STRONG_MODEL ?? SUGGESTION_FAST_MODEL
export const SUGGESTION_ROUTING_MODE = process.env.KINLOOP_SUGGESTION_ROUTING_MODE ?? 'speed'
export const ASR_MODEL = process.env.KINLOOP_ASR_MODEL ?? ''
export const ASR_BASE_URL = process.env.KINLOOP_ASR_BASE_URL ?? LLM_BASE_URL
export const ASR_API_KEY = process.env.KINLOOP_ASR_API_KEY ?? LLM_API_KEY
export const VOLC_ASR_APP_ID = process.env.KINLOOP_VOLC_ASR_APP_ID ?? ''
export const VOLC_ASR_ACCESS_TOKEN = process.env.KINLOOP_VOLC_ASR_ACCESS_TOKEN ?? ''
export const VOLC_ASR_API_KEY = process.env.KINLOOP_VOLC_ASR_API_KEY ?? ''
export const VOLC_ASR_CLUSTER = process.env.KINLOOP_VOLC_ASR_CLUSTER ?? ''
export const VOLC_ASR_RESOURCE_ID = process.env.KINLOOP_VOLC_ASR_RESOURCE_ID ?? 'volc.bigasr.auc_turbo'
export const AUTH_SESSION_TTL_MS = Number(process.env.KINLOOP_AUTH_SESSION_TTL_MS ?? 30 * 24 * 60 * 60 * 1000)
export const AUTH_CODE_TTL_MS = Number(process.env.KINLOOP_AUTH_CODE_TTL_MS ?? 10 * 60 * 1000)
export const AUTH_DEV_EXPOSE_CODES = `${process.env.KINLOOP_AUTH_DEV_EXPOSE_CODES ?? 'false'}`.toLowerCase() === 'true'
export const SMTP_HOST = process.env.KINLOOP_SMTP_HOST ?? ''
export const SMTP_PORT = Number(process.env.KINLOOP_SMTP_PORT ?? 465)
export const SMTP_SECURE = `${process.env.KINLOOP_SMTP_SECURE ?? 'true'}`.toLowerCase() !== 'false'
export const SMTP_REQUIRE_TLS = `${process.env.KINLOOP_SMTP_REQUIRE_TLS ?? 'true'}`.toLowerCase() !== 'false'
export const SMTP_USER = process.env.KINLOOP_SMTP_USER ?? ''
export const SMTP_PASS = process.env.KINLOOP_SMTP_PASS ?? ''
export const SMTP_FROM = process.env.KINLOOP_SMTP_FROM ?? SMTP_USER
