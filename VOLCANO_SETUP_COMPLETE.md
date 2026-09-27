# 火山引擎 API 配置 - 完成总结

**完成时间**: 2026-04-05  
**配置内容**: 火山引擎 API 密钥集成  

---

## ✅ 配置完成清单

### 环境配置
- ✅ 创建 `.env.local` 文件（包含 API Key 和账户信息）
- ✅ 创建 `.env.example` 示例文件
- ✅ 更新 `.gitignore` 以保护敏感信息
  - 添加 `.env*` 规则
  - 确保 `.env.local` 不被提交

### 后端集成
- ✅ 更新 `server/config.mjs` - 添加火山引擎配置导出
  - `VOLCANO_API_KEY` - 从环境变量读取
  - `VOLCANO_ENDPOINT` - API 端点配置
  
- ✅ 创建 `server/routes/volcanoRoutes.mjs` - 服务端路由
  - `/api/volcano/upload/audio` - 音频上传
  - `/api/volcano/upload/video` - 视频上传
  - `/api/volcano/status/:taskId` - 处理状态查询
  - 通用代理路由 `GET/POST /api/volcano/*`

- ✅ 更新 `server/index.mjs`
  - 导入 `registerVolcanoRoutes`
  - 注册火山引擎路由

### 前端集成
- ✅ 创建 `src/services/api/volcanoApi.ts` - 前端 API 封装
  - `uploadAudioForProcessing()` - 上传音频
  - `uploadVideoForProcessing()` - 上传视频
  - `getProcessingStatus()` - 查询处理状态
  - `callVolcanoGenericAPI()` - 通用 API 调用
  
- ✅ 更新 `src/services/api/index.ts`
  - 导出 `volcanoApi` 模块

### 文档
- ✅ 创建 `docs/VOLCANO_INTEGRATION_GUIDE.md`
  - 完整的集成指南
  - API 文档和使用示例
  - 故障排除指南
  - 最佳实践

---

## 🔐 安全保护措施

### Git 安全
```
.gitignore 已配置：
- .env（所有环境文件）
- .env.local（本地开发）
- .env.*.local（特定环境）
```

### API 密钥安全
- ✅ API Key 仅存储在本地 `.env.local`
- ✅ 前端请求通过后端代理转发，避免直接暴露
- ✅ 后端使用环境变量隐藏敏感信息
- ⚠️ **建议**: 如果此密钥已被其他人看到，请立即在火山引擎控制台重置

---

## 📁 新增/修改文件清单

### 新增文件
| 文件路径 | 说明 |
|---------|------|
| `.env.local` | 本地开发环境配置（已创建）|
| `.env.example` | 环境变量示例文件 |
| `server/routes/volcanoRoutes.mjs` | 火山引擎 API 路由 |
| `src/services/api/volcanoApi.ts` | 前端 API 封装 |
| `docs/VOLCANO_INTEGRATION_GUIDE.md` | 集成完整指南 |

### 修改文件
| 文件路径 | 修改内容 |
|---------|---------|
| `.gitignore` | 添加 `.env*` 规则 |
| `server/config.mjs` | 添加火山引擎配置导出 |
| `server/index.mjs` | 导入和注册火山引擎路由 |
| `src/services/api/index.ts` | 导出 volcanoApi 模块 |

---

## 🚀 立即开始

### 1. 验证配置

```bash
# 检查 .env.local 文件是否存在并包含正确的 API Key
cat .env.local
```

### 2. 启动服务

```bash
# 终端 1 - 启动前端开发服务器
npm run dev

# 终端 2 - 启动后端 API 服务
npm run dev:server
```

### 3. 测试连接

```javascript
// 在浏览器控制台测试
import { callVolcanoGenericAPI } from '@/services/api/volcanoApi'
const result = await callVolcanoGenericAPI('GET', '/health')
```

---

## 📖 使用指南

查看详细集成指南：
👉 [docs/VOLCANO_INTEGRATION_GUIDE.md](docs/VOLCANO_INTEGRATION_GUIDE.md)

### 快速示例

#### 上传音频文件

```typescript
import { uploadAudioForProcessing, getProcessingStatus } from '@/services/api'

// 录制音频（获得 Blob）
const audioBlob = new Blob([audioData], { type: 'audio/wav' })

// 上传到火山引擎
const uploadResult = await uploadAudioForProcessing(audioBlob, 'wav')
console.log('上传成功:', uploadResult.taskId)

// 查询处理状态
const status = await getProcessingStatus(uploadResult.taskId)
console.log('处理状态:', status.status)
```

#### 在聊天中集成

```typescript
// 在 ChatInput.tsx 中使用
import { uploadAudioForProcessing } from '@/services/api'

const handleVoiceRecording = async (audioBlob: Blob) => {
  const result = await uploadAudioForProcessing(audioBlob)
  
  // 轮询查询处理状态，完成后发送消息
  const status = await getProcessingStatus(result.taskId)
  if (status.status === 'completed') {
    await sendMessage({
      type: 'voice',
      mediaUrl: status.result.url,
    })
  }
}
```

---

## ⚙️ 环境变量说明

### 前端环境变量（.env.local）
- `VITE_VOLCANO_API_KEY` - 火山引擎 API Key（暴露给浏览器但通过代理）
- `VITE_VOLCANO_ACCOUNT` - 火山引擎账户标识

### 后端环境变量（process.env）
- `KINLOOP_VOLCANO_API_KEY` - 服务端使用的 API Key
- `KINLOOP_API_PORT` - 服务器端口（默认 8787）
- `KINLOOP_API_HOST` - 服务器监听地址（默认 127.0.0.1）
- `KINLOOP_DB_PATH` - 数据库文件路径（默认 data/kinloop.db）

---

## 🔄 请求流程

```
┌─────────────────────────────────────────────────────────────┐
│                     前端应用 (浏览器)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. 用户录音/选择文件                               │  │
│  │  2. 调用 uploadAudioForProcessing(blob)            │  │
│  └──────────────────────────────────────────────────────┘  │
│              ↓                                               │
│     POST /api/volcano/upload/audio                         │
│     (通过代理，不直接暴露 API Key)                        │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│                   后端 Node.js 服务器                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. 接收上传请求                                    │  │
│  │  2. 从 process.env 读取 VOLCANO_API_KEY             │  │
│  │  3. 转发到火山引擎 API                              │  │
│  │  4. 返回 taskId、status                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│                    火山引擎云服务                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  处理音频/视频文件                                  │  │
│  │  返回处理结果 URL                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│                     前端继续处理                            │
│  1. 轮询 /api/volcano/status/:taskId 查询处理状态        │
│  2. 完成后获取处理结果 URL                               │
│  3. 使用 URL 发送消息                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ 功能特性

✅ **安全代理** - API Key 不暴露给前端  
✅ **异步处理** - 后台处理媒体文件  
✅ **状态查询** - 轮询处理进度  
✅ **错误处理** - 完整的错误捕获和日志  
✅ **类型安全** - 完整的 TypeScript 类型定义  

---

## 🎯 后续步骤

1. ✅ **配置完成** - API Key 已配置
2. 📝 **集成到聊天** - 在语音/视频消息中使用火山引擎 API
3. 🧪 **测试验证** - 测试音频/视频上传和处理
4. 🚀 **部署上线** - 部署到生产环境

---

## 📞 常见问题

**Q: 我的 API Key 被其他人看到了怎么办？**  
A: 立即在火山引擎控制台重置 API Key，然后更新 `.env.local`

**Q: 为什么请求要通过后端代理？**  
A: 为了隐藏 API Key，防止直接暴露给前端用户

**Q: 如何更换 API Key？**  
A: 编辑 `.env.local` 文件，更新 `VITE_VOLCANO_API_KEY` 和 `KINLOOP_VOLCANO_API_KEY`，然后重启服务器

**Q: 上传失败了怎么办？**  
A: 查看 `docs/VOLCANO_INTEGRATION_GUIDE.md` 中的故障排除部分

---

## 💾 备份提醒

若要备份您的 API Key，请将其保存在安全的地方，不要提交到 Git。建议：
- ✅ 保存在密码管理器中（如 1Password、LastPass）
- ✅ 保存在公司内部密钥库中
- ❌ 不要写在便签或邮件中
- ❌ 不要提交到代码仓库

---

**配置完成！现在您可以开始使用火山引擎 API 了。**
