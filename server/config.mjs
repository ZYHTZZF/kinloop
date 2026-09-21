import { resolve } from 'node:path'

export const API_PORT = Number(process.env.KINLOOP_API_PORT ?? 8787)
export const API_HOST = process.env.KINLOOP_API_HOST ?? '127.0.0.1'
export const DB_PATH = process.env.KINLOOP_DB_PATH
  ? resolve(process.cwd(), process.env.KINLOOP_DB_PATH)
  : resolve(process.cwd(), 'data', 'kinloop.db')

// 火山引擎配置
export const VOLCANO_API_KEY = process.env.KINLOOP_VOLCANO_API_KEY ?? ''
export const VOLCANO_ENDPOINT = 'https://api.volcanoapi.com' // 火山引擎 API 端点
