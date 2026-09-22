/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 火山引擎 API 集成服务
 * 用于语音、视频处理等服务
 */

const VOLCANO_API_KEY = import.meta.env.VITE_VOLCANO_API_KEY
const VOLCANO_ACCOUNT = import.meta.env.VITE_VOLCANO_ACCOUNT

if (!VOLCANO_API_KEY) {
  console.warn('[Volcano] API Key 未配置，某些功能可能不可用')
}

/**
 * 火山引擎 API 基础配置
 */
interface VolcanoRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  data?: Record<string, any>
}

/**
 * 向火山引擎 API 发送请求
 */
async function callVolcanoAPI(config: VolcanoRequestConfig): Promise<any> {
  if (!VOLCANO_API_KEY) {
    throw new Error('Volcano API Key 未配置')
  }

  // 通过后端代理调用（不直接调用，避免暴露 API Key）
  const response = await fetch(`/api/volcano${config.path}`, {
    method: config.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOLCANO_API_KEY}`,
    },
    body: config.data ? JSON.stringify(config.data) : undefined,
  })

  if (!response.ok) {
    throw new Error(`Volcano API 错误: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * 上传音频文件进行处理
 * @param audioBlob 音频数据
 * @param format 音频格式 (mp3, wav, aac 等)
 * @returns 处理结果
 */
export async function uploadAudioForProcessing(
  audioBlob: Blob,
  format: string = 'wav'
): Promise<{
  taskId: string
  url: string
  status: 'processing' | 'completed' | 'failed'
}> {
  const formData = new FormData()
  formData.append('audio', audioBlob)
  formData.append('format', format)
  formData.append('account', VOLCANO_ACCOUNT || 'default')

  const response = await fetch('/api/volcano/upload/audio', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOLCANO_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`音频上传失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 上传视频文件进行处理
 * @param videoBlob 视频数据
 * @param format 视频格式
 * @returns 处理结果
 */
export async function uploadVideoForProcessing(
  videoBlob: Blob,
  format: string = 'mp4'
): Promise<{
  taskId: string
  url: string
  status: 'processing' | 'completed' | 'failed'
}> {
  const formData = new FormData()
  formData.append('video', videoBlob)
  formData.append('format', format)
  formData.append('account', VOLCANO_ACCOUNT || 'default')

  const response = await fetch('/api/volcano/upload/video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOLCANO_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`视频上传失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 获取文件处理状态
 */
export async function getProcessingStatus(taskId: string): Promise<{
  status: 'processing' | 'completed' | 'failed'
  result?: any
  error?: string
}> {
  const response = await fetch(`/api/volcano/status/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${VOLCANO_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`获取处理状态失败: ${response.statusText}`)
  }

  return response.json()
}

/**
 * 调用火山引擎通用 API
 * @param method HTTP 方法
 * @param path API 路径
 * @param data 请求数据
 */
export async function callVolcanoGenericAPI(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  data?: Record<string, any>
): Promise<any> {
  return callVolcanoAPI({
    method,
    path,
    data,
  })
}

export default {
  uploadAudioForProcessing,
  uploadVideoForProcessing,
  getProcessingStatus,
  callVolcanoGenericAPI,
}
