/**
 * 火山引擎 API 路由处理器
 * 在服务端代理火山引擎 API 调用
 */

import { VOLCANO_API_KEY, VOLCANO_ENDPOINT } from '../config.mjs'

/**
 * 代理火山引擎 API 请求
 */
export async function proxyVolcanoRequest(
  method,
  path,
  body,
  headers
) {
  if (!VOLCANO_API_KEY) {
    throw new Error('火山引擎 API Key 未配置')
  }

  const url = `${VOLCANO_ENDPOINT}${path}`

  const requestOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOLCANO_API_KEY}`,
      ...headers,
    },
  }

  if (body) {
    requestOptions.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, requestOptions)

    if (!response.ok) {
      throw new Error(`火山引擎 API 错误: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Volcano] API 请求失败:', error)
    throw error
  }
}

/**
 * 注册火山引擎 API 路由到 Express 服务器
 */
export function registerVolcanoRoutes(app) {
  // GET 请求代理
  app.get('/api/volcano/*path', async (req, res) => {
    try {
      const path = req.params.path ? `/${req.params.path}` : ''
      const result = await proxyVolcanoRequest('GET', path, null, req.headers)
      res.json(result)
    } catch (error) {
      console.error('[Volcano] GET 请求失败:', error)
      res.status(500).json({ error: '火山引擎 API 调用失败' })
    }
  })

  // POST 请求代理
  app.post('/api/volcano/*path', async (req, res) => {
    try {
      const path = req.params.path ? `/${req.params.path}` : ''
      const result = await proxyVolcanoRequest('POST', path, req.body, req.headers)
      res.json(result)
    } catch (error) {
      console.error('[Volcano] POST 请求失败:', error)
      res.status(500).json({ error: '火山引擎 API 调用失败' })
    }
  })

  // 文件上传处理
  app.post('/api/volcano/upload/:type', async (req, res) => {
    try {
      const uploadType = req.params.type // audio 或 video
      
      if (!req.files || !req.files[uploadType]) {
        return res.status(400).json({ error: '缺少上传文件' })
      }

      const file = req.files[uploadType]
      
      // 这里可以调用火山引擎的文件上传 API
      // 或者先保存到本地，再上传到火山引擎
      
      res.json({
        taskId: `task_${Date.now()}`,
        url: `/files/${uploadType}/${file.name}`,
        status: 'processing',
      })
    } catch (error) {
      console.error('[Volcano] 文件上传失败:', error)
      res.status(500).json({ error: '文件上传失败' })
    }
  })

  // 获取处理状态
  app.get('/api/volcano/status/:taskId', async (req, res) => {
    try {
      const taskId = req.params.taskId
      
      // 调用火山引擎的状态查询 API
      const result = await proxyVolcanoRequest(
        'GET',
        `/tasks/${taskId}/status`,
        null,
        req.headers
      )
      
      res.json(result)
    } catch (error) {
      console.error('[Volcano] 状态查询失败:', error)
      res.status(500).json({ error: '状态查询失败' })
    }
  })
}

export default { proxyVolcanoRequest, registerVolcanoRoutes }
