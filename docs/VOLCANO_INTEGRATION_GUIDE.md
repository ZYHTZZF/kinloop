# 火山引擎 API 集成指南

**最后更新**: 2026-04-05

## 📋 目录

1. [快速开始](#快速开始)
2. [配置](#配置)
3. [API 文档](#api-文档)
4. [使用示例](#使用示例)
5. [最佳实践](#最佳实践)
6. [故障排除](#故障排除)

---

## 🚀 快速开始

### 1. 配置凭证

在项目根目录创建或编辑 `.env.local` 文件：

```env
# 火山引擎配置
VITE_VOLCANO_API_KEY=REDACTED_CONFIGURE_IN_ENV
VITE_VOLCANO_ACCOUNT=啦啦啦啦叭叭哔

# 服务端配置
KINLOOP_VOLCANO_API_KEY=REDACTED_CONFIGURE_IN_ENV
```

**⚠️ 安全提醒**：`.env.local` 已在 `.gitignore` 中配置，不会提交到 Git 仓库。

### 2. 启动开发服务器

```bash
# 前端
npm run dev

# 服务端（另一个终端）
npm run dev:server
```

---

## ⚙️ 配置

### 环境变量

| 变量名 | 位置 | 用途 |
|--------|------|------|
| `VITE_VOLCANO_API_KEY` | `.env.local` | 前端使用的 API Key |
| `VITE_VOLCANO_ACCOUNT` | `.env.local` | 火山引擎账户标识 |
| `KINLOOP_VOLCANO_API_KEY` | `.env.local` | 服务端使用的 API Key |
| `KINLOOP_VOLCANO_ENDPOINT` | 代码配置 | 火山引擎 API 端点 |

### 服务端配置

文件: `server/config.mjs`

```javascript
export const VOLCANO_API_KEY = process.env.KINLOOP_VOLCANO_API_KEY ?? ''
export const VOLCANO_ENDPOINT = 'https://api.volcanoapi.com'
```

### 前端配置

文件: `src/services/api/volcanoApi.ts`

- 自动读取 `import.meta.env.VITE_VOLCANO_API_KEY` 和 `VITE_VOLCANO_ACCOUNT`
- 通过后端代理调用，避免 API Key 暴露

---

## 📚 API 文档

### 前端 API

#### 1. 上传音频文件

```typescript
import { uploadAudioForProcessing } from '@/services/api/volcanoApi'

// 使用示例
const audioBlob = new Blob([audioData], { type: 'audio/wav' })
const result = await uploadAudioForProcessing(audioBlob, 'wav')

// 返回值
{
  taskId: 'task_1234567890',
  url: '/files/audio/recording.wav',
  status: 'processing'  // 'processing' | 'completed' | 'failed'
}
```

#### 2. 上传视频文件

```typescript
import { uploadVideoForProcessing } from '@/services/api/volcanoApi'

// 使用示例
const videoBlob = new Blob([videoData], { type: 'video/mp4' })
const result = await uploadVideoForProcessing(videoBlob, 'mp4')

// 返回值
{
  taskId: 'task_1234567890',
  url: '/files/video/recording.mp4',
  status: 'processing'
}
```

#### 3. 查询处理状态

```typescript
import { getProcessingStatus } from '@/services/api/volcanoApi'

// 使用示例
const status = await getProcessingStatus('task_1234567890')

// 返回值
{
  status: 'completed',  // 'processing' | 'completed' | 'failed'
  result: {
    // 处理结果数据
  },
  error?: 'Error message'
}
```

#### 4. 通用 API 调用

```typescript
import { callVolcanoGenericAPI } from '@/services/api/volcanoApi'

// 使用示例
const result = await callVolcanoGenericAPI(
  'POST',
  '/some/endpoint',
  { data: 'value' }
)
```

---

## 💡 使用示例

### 示例 1: 发送语音消息

```typescript
// 在聊天输入组件中
import { uploadAudioForProcessing } from '@/services/api'

async function sendVoiceMessage(audioBlob: Blob) {
  try {
    // 上传到火山引擎
    const uploadResult = await uploadAudioForProcessing(audioBlob, 'wav')
    
    // 轮询检查处理状态
    let attempts = 0
    while (attempts < 30) {  // 最多等待 30 秒
      const status = await getProcessingStatus(uploadResult.taskId)
      
      if (status.status === 'completed') {
        // 发送消息，包含处理后的 URL
        await sendMessage({
          conversationId,
          type: 'voice',
          mediaUrl: status.result.processedUrl,
          voiceDurationMs: audioBlob.size,
        })
        break
      } else if (status.status === 'failed') {
        throw new Error(`处理失败: ${status.error}`)
      }
      
      // 等待 1 秒再次检查
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++
    }
  } catch (error) {
    console.error('语音消息发送失败:', error)
    // 显示用户提示
  }
}
```

### 示例 2: 发送视频消息

```typescript
import { uploadVideoForProcessing, getProcessingStatus } from '@/services/api'

async function sendVideoMessage(videoBlob: Blob) {
  try {
    const uploadResult = await uploadVideoForProcessing(videoBlob, 'mp4')
    
    // 定期检查处理状态
    const checkStatus = async () => {
      const status = await getProcessingStatus(uploadResult.taskId)
      
      if (status.status === 'completed') {
        await sendMessage({
          conversationId,
          type: 'image',  // 或作为视频类型
          mediaUrl: status.result.processedUrl,
        })
      } else if (status.status === 'failed') {
        showError(`视频处理失败: ${status.error}`)
      } else {
        // 继续等待
        setTimeout(checkStatus, 2000)
      }
    }
    
    checkStatus()
  } catch (error) {
    console.error('视频上传失败:', error)
  }
}
```

### 示例 3: 集成到聊天输入组件

```typescript
// 在 ChatInput.tsx 中
import { uploadAudioForProcessing, uploadVideoForProcessing } from '@/services/api'

export function ChatInput() {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleVoiceRecording = async (audioBlob: Blob) => {
    setIsProcessing(true)
    try {
      // 显示"处理中..."提示
      const result = await uploadAudioForProcessing(audioBlob)
      
      // 保存任务 ID，稍后查询状态
      onVoiceRecorded({
        audioBlob,
        taskId: result.taskId,
        mediaUrl: result.url,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div>
      {isProcessing && <span>处理中...</span>}
      {/* 其他输入组件 */}
    </div>
  )
}
```

---

## ✨ 最佳实践

### 1. 错误处理

始终使用 try-catch 包装 API 调用：

```typescript
try {
  const result = await uploadAudioForProcessing(audioBlob)
} catch (error) {
  if (error.message.includes('API Key')) {
    showError('系统配置未完成')
  } else if (error.message.includes('400')) {
    showError('文件格式不支持')
  } else {
    showError('上传失败，请重试')
  }
}
```

### 2. 超时处理

为长时间处理的任务设置超时：

```typescript
async function waitForProcessing(
  taskId: string,
  maxWaitTime = 60000  // 60 秒
) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await getProcessingStatus(taskId)
    
    if (status.status !== 'processing') {
      return status
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  throw new Error('处理超时')
}
```

### 3. 用户反馈

显示处理進度：

```typescript
const [uploadProgress, setUploadProgress] = useState<{
  taskId: string
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number  // 0-100
} | null>(null)

const handleUpload = async (file: Blob) => {
  setUploadProgress({ taskId: '', status: 'uploading', progress: 0 })
  
  try {
    const result = await uploadAudioForProcessing(file)
    setUploadProgress(prev => ({
      ...prev!,
      taskId: result.taskId,
      status: 'processing',
      progress: 33,
    }))
    
    // 轮询更新進度
    const updateProgress = setInterval(async () => {
      const status = await getProcessingStatus(result.taskId)
      
      if (status.status === 'completed') {
        setUploadProgress(prev => ({
          ...prev!,
          status: 'completed',
          progress: 100,
        }))
        clearInterval(updateProgress)
      } else if (status.status === 'failed') {
        setUploadProgress(prev => ({
          ...prev!,
          status: 'failed',
        }))
        clearInterval(updateProgress)
      }
    }, 2000)
  } catch (error) {
    setUploadProgress(prev => ({ ...prev!, status: 'failed' }))
  }
}
```

---

## 🔧 故障排除

### 问题 1: API Key 未配置

**症状**: 控制台显示 `[Volcano] API Key 未配置`

**解决方案**:
1. 检查 `.env.local` 文件是否存在
2. 确认 `VITE_VOLCANO_API_KEY` 和 `KINLOOP_VOLCANO_API_KEY` 正确填写
3. 重启开发服务器：`npm run dev`

### 问题 2: 文件上传失败 (400 错误)

**症状**: `火山引擎 API 错误: 400`

**解决方案**:
1. 检查文件格式是否支持（音频: wav/mp3/aac，视频: mp4/mov）
2. 检查文件大小是否超过限制
3. 确保 Blob 类型正确：`new Blob([data], { type: 'audio/wav' })`

### 问题 3: 处理超时

**症状**: 处理状态长时间为 `processing`

**解决方案**:
1. 检查网络连接
2. 查看火山引擎仪表板是否有服务状况公告
3. 增加轮询间隔或最大等待时间
4. 尝试重新上传文件

### 问题 4: CORS 错误

**症状**: 浏览器控制台显示 CORS 相关错误

**解决方案**:
1. 确保请求通过后端代理（使用 `/api/volcano/*` 路由）
2. 不要直接调用火山引擎 API
3. 检查 `server/routes/volcanoRoutes.mjs` 中的 CORS 配置

### 问题 5: API Key 泄露

**症状**: 发现 API Key 被提交到 Git

**解决方案**:
1. 立即在火山引擎控制台重置 API Key
2. 从 Git 历史中清除敏感信息：
   ```bash
   git filter-branch --tree-filter 'rm -f .env.local'
   ```
3. 强制推送（谨慎操作）：
   ```bash
   git push origin --force
   ```

---

## 📝 API 端点参考

### 服务端代理路由

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/volcano/upload/audio` | 上传音频文件 |
| POST | `/api/volcano/upload/video` | 上传视频文件 |
| GET | `/api/volcano/status/:taskId` | 查询处理状态 |
| GET/POST | `/api/volcano/*` | 通用代理路由 |

### 火山引擎官方文档

- [火山引擎 API 文档](https://www.volcanoapi.com/docs)
- [媒体处理 API](https://www.volcanoapi.com/docs/media)
- [错误代码参考](https://www.volcanoapi.com/docs/errors)

---

## 🎯 常见场景

### 场景 1: 发送群组消息

```typescript
// 暂时不支持（应用为 1-on-1 设计）
```

### 场景 2: 消息转发

```typescript
// 获取原消息的媒体 URL，重新发送
const forwardMessage = async (originalMessage: IMessage) => {
  if (originalMessage.mediaUrl) {
    await sendMessage({
      conversationId: newConversationId,
      type: originalMessage.type,
      mediaUrl: originalMessage.mediaUrl,
    })
  }
}
```

### 场景 3: 离线消息同步

```typescript
// 消息存储在 IndexedDB，重新连接时自动同步
```

---

## 📞 支持

如有问题，请：

1. 检查 `CHAT_FEATURE_COMPLETION.md` 获取聊天功能概况
2. 查看 `docs/chat-prd-v1.md` 了解产品设计
3. 参考本文档的故障排除部分
4. 查看浏览器控制台的错误日志
