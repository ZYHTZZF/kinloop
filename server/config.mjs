import { resolve } from 'node:path'
import { loadServerEnv } from './loadEnv.mjs'

loadServerEnv()

export const API_PORT = Number(process.env.KINLOOP_API_PORT ?? 8787)
export const API_HOST = process.env.KINLOOP_API_HOST ?? '127.0.0.1'
export const DB_PATH = process.env.KINLOOP_DB_PATH
  ? resolve(process.cwd(), process.env.KINLOOP_DB_PATH)
  : resolve(process.cwd(), 'data', 'kinloop.db')

// Volcano-related config
export const VOLCANO_API_KEY = process.env.KINLOOP_VOLCANO_API_KEY ?? ''
export const VOLCANO_ENDPOINT = 'https://api.volcanoapi.com'

// LLM intent parsing (OpenAI-compatible chat/completions endpoint)
export const LLM_API_KEY = process.env.KINLOOP_LLM_API_KEY ?? process.env.KINLOOP_VOLCANO_API_KEY ?? ''
export const LLM_BASE_URL = process.env.KINLOOP_LLM_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3'
export const LLM_MODEL = process.env.KINLOOP_LLM_MODEL ?? ''
export const ASR_MODEL = process.env.KINLOOP_ASR_MODEL ?? ''
export const VOLC_ASR_APP_ID = process.env.KINLOOP_VOLC_ASR_APP_ID ?? ''
export const VOLC_ASR_ACCESS_TOKEN = process.env.KINLOOP_VOLC_ASR_ACCESS_TOKEN ?? ''
export const VOLC_ASR_RESOURCE_ID = process.env.KINLOOP_VOLC_ASR_RESOURCE_ID ?? 'volc.bigasr.auc_turbo'
