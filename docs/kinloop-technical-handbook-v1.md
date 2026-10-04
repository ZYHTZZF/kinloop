# Kinloop 技术总手册（跨对话接手版）

> 目的：让任意 AI / 任意新对话在只读取本文件的前提下，快速理解并接手 `Kinloop` 项目的技术实现。
> 覆盖范围：前端、后端、数据模型、接口、关键链路、状态机、运行方式、已知问题、接手建议。
> 更新基线：基于当前工作区 `D:\银龄心语\kinloop`。
> 校验快照：`dev@b1bbe1c`（已对关键路由、脚本、语音/情绪核心链路做事实抽查）。
> 最后校验日期：2026-04-09（Asia/Shanghai）。
> 备注：当前工作区存在未提交改动，本手册已按“当前工作区代码”复核，不仅限于 `b1bbe1c` 快照。

---

## 1. 项目定位与技术栈

### 1.1 产品形态
1. 单仓库，包含前端（老人端 + 家人端 + 营销页）和本地 API 服务。
2. 主要业务：家庭聊天、AI 辅助语音意图、情绪识别、求助与协作、回忆沉淀。
3. 运行模式：本地优先（SQLite + Express + WebSocket + 前端 fallback mock）。

### 1.2 技术栈
1. 前端：React 19 + TypeScript + React Router 7 + Vite 8。
2. 后端：Node.js ESM + Express 5 + `node:sqlite` + `ws`。
3. 数据：SQLite 文件库（默认 `data/kinloop.db`）。
4. 实时：WebSocket（会话更新、WebRTC 信令转发）。
5. 音视频：浏览器 WebRTC（STUN Google 公共服务器）。
6. 情绪识别：适配器架构（文本/语气/人脸），支持真实 provider 与 mock fallback。

### 1.3 包管理与脚本
`package.json`:
1. `npm run dev` / `npm run dev:web`：启动 Vite 前端。
2. `npm run dev:api`：启动本地 API（`node server/index.mjs`）。
3. `npm run build`：`tsc -b && vite build`。
4. `npm run lint`：ESLint。
5. `npm run preview`：Vite preview。

---

## 2. 代码目录与职责映射

### 2.1 顶层关键目录
1. `src/`：前端主代码。
2. `server/`：后端 API、数据库、情绪服务。
3. `data/`：SQLite 文件与上传资源目录。
4. `scripts/`：辅助校验脚本（主要是 Volcano 配置校验）。
5. `docs/`：产品/技术文档。
6. `public/`：静态资源。

### 2.2 前端目录职责
1. `src/app/`：应用入口、路由、双端 Layout。
2. `src/pages/elder/`：老人端页面。
3. `src/pages/family/`：家人端页面。
4. `src/components/`：可复用组件（聊天、通话、通用 UI）。
5. `src/services/api/`：HTTP/WS API 封装、类型、mock fallback。
6. `src/services/webrtc/`：WebRTC 会话管理与网络自适应。
7. `src/domain/`：领域规则（例如老人语音意图本地分类）。
8. `src/utils/`：时间、通知、IndexedDB 存储等工具。

### 2.3 后端目录职责
1. `server/index.mjs`：主服务入口，绝大多数 API 路由定义，WebSocket 初始化。
2. `server/config.mjs`：环境变量读取与默认值。
3. `server/loadEnv.mjs`：`.env.local/.env` 解析加载。
4. `server/db/`：SQLite 初始化、建表、种子数据。
5. `server/repositories/`：业务数据访问层（SQL 封装）。
6. `server/services/emotion/`：情绪识别适配、provider 接口、fallback。
7. `server/routes/`：可选路由模块（`asrRoutes` 已挂载，`aiIntentRoutes`/`volcanoRoutes` 当前未挂载）。

---

## 3. 运行拓扑与请求路径

### 3.1 本地运行拓扑
1. 前端默认运行在 `http://127.0.0.1:5173`（Vite）。
2. 后端默认运行在 `http://127.0.0.1:8787`（Express）。
3. Vite 将 `/api` 代理到 `8787`。
4. WebSocket 连接地址默认推导为 `ws://<host>:8787`（`src/services/api/realtime.ts`）。

### 3.2 CORS / 静态
1. `server/index.mjs` 允许 `*` 跨域（`GET,POST,PATCH,OPTIONS`）。
2. `/uploads` 映射到本地上传目录 `data/uploads`。

---

## 4. 前端应用结构

### 4.1 入口与路由
1. 前端入口：`src/main.tsx -> src/app/App.tsx -> RouterProvider`。
2. 路由定义：`src/app/router.tsx`。
3. 根路径 `/` 重定向到 `/elder/home`。
4. 老人端路由：
   - `/elder/home`
   - `/elder/inbox`
   - `/elder/conversations/:conversationId`
   - `/elder/help`
5. 家人端路由：
   - `/family/today`
   - `/family/status`
   - `/family/chats`
   - `/family/chats/:conversationId`
   - `/family/memories`
   - `/family/collaboration`

### 4.2 页面与核心职责
1. `ElderHomePage`：老人首页，展示会话胶片风卡片。
2. `ElderVoiceAssistant`：全局语音助手（语音录制、转写、意图识别、自动动作）。
3. `ElderContactsPage`：老人会话列表。
4. `ElderConversationPage`：老人会话详情，支持消息 + WebRTC 通话 + 加回忆。
5. `ElderHelpPage`：老人求助入口（UNWELL / SOS）。
6. `FamilyTodayPage`：家人今日状态（异常情绪 + 周汇总）。
7. `FamilyStatusPage`：Pulse/Followup 时间线闭环。
8. `FamilyChatsPage`：家人会话列表。
9. `FamilyConversationPage`：家人会话详情，支持消息 + WebRTC + 情绪 chip。
10. `FamilyMemoriesPage`：家庭回忆时间线。
11. `FamilyCollaborationPage`：协作任务、邀请、Alert 处理。

### 4.3 样式体系
1. 主样式：`src/app/app.css`（老人/家人双主题，页面级与组件级样式聚合）。
2. 部分组件有 module.css（聊天、通话相关）。
3. 营销页独立样式：`src/marketing.css`。

### 4.4 营销页
1. 入口：`marketing.html` + `src/marketing.tsx`。
2. Vite build 配置了多入口（`main` + `marketing`）。

---

## 5. API 客户端层（前端）

### 5.1 统一 HTTP 客户端
`src/services/api/client.ts`:
1. `apiGet/apiPost/apiPatch` 统一封装。
2. 失败时按规则自动 fallback 到 `mockApi`。
3. fallback 触发条件：网络失败或 5xx/502/503/504。

### 5.2 各业务 API 包装
1. `conversationApi.ts`：会话卡片、会话详情、发送消息。
2. `aiIntentApi.ts`：老人语音意图服务端识别。
3. `emotionApi.ts`：情绪分析触发。
4. `alertApi.ts`：Alert 查询/创建/接单/关闭。
5. `followupApi.ts`：Followup 列表与创建。
6. `memoryApi.ts`：回忆列表与创建。
7. `inviteApi.ts`：邀请码列表/创建/审批。
8. `memberApi.ts`、`familySpaceApi.ts`、`permissionPolicyApi.ts`、`pulseApi.ts`。

### 5.3 WebSocket / 聊天兼容层
`src/services/api/chatApi.ts`:
1. 连接 WebSocket、注册用户、处理信令。
2. 维护消息监听器、状态监听器。
3. 提供 `setWebrtcSignalHandler` 与 `setConversationUpdateHandler`。
4. 兼容本地 IndexedDB（`utils/storage.ts`）消息缓存。

> 注意：项目存在两套“聊天数据模型”。
> 1) 业务主链路消息发送使用 `conversationApi.sendMessage`（REST + SQLite）。
> 2) `chatApi` 仍承载 WS 信令与 IndexedDB 会话缓存接口；`chatApi.sendMessage` 在当前主页面链路中未直接调用，属于遗留能力。

---

## 6. WebRTC 与实时通信实现

### 6.1 WebRTC 管理器
`src/services/webrtc/WebRTCManager.ts`:
1. 支持语音/视频呼叫发起、接听、拒绝、挂断。
2. 封装 PeerConnection 生命周期。
3. 通过 `signalingClient` 发送 `offer/answer/ice-candidate/reject/hangup`。
4. 事件系统：`call-initiated`、`connection-state-changed`、`call-ended` 等。
5. 提供 `toggleAudio` / `toggleVideo`。

### 6.2 网络自适应
`src/services/webrtc/NetworkAdapt.ts`:
1. 按 packetLoss / RTT 粗分 `high|medium|low` 质量。
2. 通过 sender parameters 调整码率、帧率、分辨率缩放。

### 6.3 服务端 WebSocket 行为
`server/index.mjs`:
1. `register`：将 `userId -> ws` 存入 `realtimeClients`。
2. `webrtc-signal`：按目标用户转发信令。
3. 会话发消息成功后，通过 `conversation-updated` 推送会话更新事件。

---

## 7. 后端 API 总览（已挂载）

### 7.1 健康与基础
1. `GET /api/health`
2. `GET /api/family-space`
3. `GET /api/members`

### 7.2 语音 / AI
1. `POST /api/asr/transcribe`（来自 `registerAsrRoutes`）
2. `POST /api/ai/elder-intent`（当前在 `server/index.mjs` 内联实现）

### 7.3 会话与消息
1. `GET /api/conversations/cards?viewer=elder|family`
2. `GET /api/conversations/:conversationId`
3. `POST /api/conversations/:conversationId/messages`

### 7.4 回忆 / 情绪
1. `GET /api/memories`
2. `POST /api/memories`
3. `GET /api/pulses/today`
4. `GET /api/pulses/history`
5. `POST /api/emotions/analyze`

### 7.5 协作与告警
1. `GET /api/followups`
2. `POST /api/followups`
3. `GET /api/alerts/active`
4. `POST /api/alerts`
5. `PATCH /api/alerts/:alertId/acknowledge`
6. `PATCH /api/alerts/:alertId/resolve`
7. `GET /api/permission-policies`
8. `GET /api/invites`
9. `POST /api/invites`
10. `PATCH /api/invites/:inviteId/approve`

---

## 8. API 关键行为细节

### 8.1 `POST /api/conversations/:id/messages`
1. 写入消息到 `messages` 表。
2. 更新 `conversations.last_meaningful_activity_at`。
3. 推送 WebSocket `conversation-updated`。
4. 异步 fire-and-forget 调用情绪分析：
   - 根据消息类型提取 text/image/audio/transcript。
   - 有效载荷时调用 `analyzeEmotionsAndCreatePulses`。

### 8.2 `POST /api/ai/elder-intent`
1. 有 `LLM_API_KEY + LLM_MODEL` 时先请求 LLM。
2. LLM失败/不可用时 fallback 到本地规则分类。
3. 结果字段包括：`intentType`, `nextAction`, `target*`, `urgencyLevel`, `draftText`, `autoSendMessage`。

### 8.3 `POST /api/asr/transcribe`
1. 优先走 Volc ASR（`openspeech` 接口，含多 resource/auth header 组合尝试）。
2. 失败后 fallback 到 OpenAI-compatible `/audio/transcriptions` 多 endpoint 尝试。
3. 全部失败返回 502 聚合错误信息。

### 8.4 `POST /api/emotions/analyze`
1. 校验输入需有 `conversationId/familySpaceId` 且至少一种模态。
2. 执行 text/face/voice adapter，失败按策略 fallback。
3. 每个结果生成一条 `Pulse(Emotion)` 并落库。

---

## 9. 数据库设计（SQLite）

### 9.1 初始化
`server/db/index.mjs`:
1. 自动创建目录。
2. 启用 WAL 模式。
3. 执行建表与种子。

### 9.2 表清单
1. `family_spaces`
2. `members`
3. `conversations`
4. `messages`
5. `memory_entries`
6. `pulses`
7. `followup_records`
8. `alerts`
9. `permission_policies`
10. `invite_codes`

### 9.3 与业务核心关系
1. 会话详情：`conversations + messages + pulses(emotion关联)`。
2. 回忆：`memory_entries` 可指向源会话与源消息。
3. 情绪：`pulses` 承载识别结果与来源摘要。
4. 告警闭环：`alerts` + `followup_records`。
5. 权限：`permission_policies`（当前偏展示，未做强服务端鉴权）。

### 9.4 schema 演进
`server/db/schema.mjs` 在初始化时尝试 `ALTER TABLE pulses ADD COLUMN ...`，重复执行异常会被吞掉（幂等式迁移风格）。

---

## 10. Repository 层职责

### 10.1 `conversationRepository.mjs`
1. `listConversationCards(viewer)`：按角色生成会话卡片与 unread 统计。
2. `getConversationDetail(id)`：加载会话 + 消息 + 关联情绪 chip 数据。
3. `createMessage(id,payload)`：插入消息并刷新会话活跃时间。

### 10.2 `pulseRepository.mjs`
1. 查询 today/history（目前同实现）。
2. `createPulse` 支持情绪扩展字段（`sourceMessageId/sourceExcerpt/emotion*`）。

### 10.3 `alertRepository.mjs`
1. 活跃告警查询。
2. 创建告警。
3. 接单（状态转 `HANDLING`）。
4. 关闭（状态转 `RESOLVED`）。

### 10.4 `followupRepository.mjs`
1. 创建 Followup 时可联动关闭 Pulse / Alert。

### 10.5 其他仓储
1. `memberRepository`：成员列表（按角色排序）。
2. `memoryRepository`：回忆列表/创建。
3. `inviteRepository`：邀请码列表/创建/审批。
4. `familySpaceRepository`：当前家庭空间。
5. `permissionPolicyRepository`：权限策略读取。

---

## 11. 情绪识别子系统

### 11.1 模块组成
1. `emotionService.mjs`：总编排（当前为串行调用：text -> face -> voice，含 fallback、落库）。
2. `adapters/*.mjs`：文本、人脸、语气三个适配器。
3. `providerClients.mjs`：Baidu NLP/人脸 + Hume 语气 provider 客户端。
4. `mockProviders.mjs`：词典启发式 mock。
5. `common.mjs`：分数归一、severity、summary、重试、HTTP调用。
6. `errors.mjs`：统一错误码。

### 11.2 执行逻辑
1. 输入标准化：`normalizeEmotionRequest`。
2. 模态条件：
   - `text` 非空 -> 文本识别
   - `imageUrl` 非空 -> 人脸识别
   - `audioUrl` 或 `transcript` 非空 -> 语气识别
3. 语气失败回退：
   - 有 transcript/text 时降级走 `text_fallback`
4. 每个结果都写 Pulse。

### 11.3 结果形态
1. `source`：`text | face | voice_tone | text_fallback`
2. `label`：`positive/neutral/negative/anxious/sad/angry/calm`
3. `severity`：`LOW/MEDIUM/HIGH`
4. `summary`：前端可直接展示的描述文本。

---

## 12. 语音助手与意图系统

### 12.1 前端入口
`src/components/elder/ElderVoiceAssistant.tsx`
1. 阶段机：`idle/recording/transcribing/classifying/result/acting`。
2. 支持 browser speech recognition 与 MediaRecorder 双路径。
3. 调用 `inferElderIntent`，失败时 fallback 本地 `classifyElderSpeech`。
4. 根据 `nextAction` 自动执行：
   - `open_conversation`
   - `trigger_alert`
   - `save_memory`
   - `open_memories`
   - `stay/clarify`

### 12.2 本地意图规则
`src/domain/elderVoice.ts`
1. keyword + 别名匹配。
2. 输出统一结果结构 `ElderVoiceIntentResult`。
3. 能力：聊天、求助、记忆保存/打开、陪伴。

### 12.3 服务端意图规则
1. `server/index.mjs` 内含一版本地规则 + LLM 尝试。
2. `server/routes/aiIntentRoutes.mjs` 存在更完整版本（重试、rule guard 等），但当前未挂载。

---

## 13. Mock 与容错策略

### 13.1 HTTP fallback mock
1. 网络失败或 5xx 时前端自动走 `mockApi.ts`。
2. mock state 持久化到 `localStorage` (`kinloop-mock-state-v1`)。
3. mock 支持多数主流程接口，方便离线演示。

### 13.2 情绪 fallback
1. provider 不可用 -> mock provider。
2. 语气失败 -> 文本降级。

### 13.3 ASR fallback
1. Volc ASR 优先。
2. OpenAI-compatible ASR 次级。

---

## 14. 环境变量总表

### 14.1 通用后端
1. `KINLOOP_API_PORT`（默认 `8787`）
2. `KINLOOP_API_HOST`（默认 `127.0.0.1`）
3. `KINLOOP_DB_PATH`（默认 `data/kinloop.db`）
4. `KINLOOP_VOLCANO_API_KEY`

### 14.2 LLM / ASR
1. `KINLOOP_LLM_API_KEY`
2. `KINLOOP_LLM_BASE_URL`（默认 `https://ark.cn-beijing.volces.com/api/v3`）
3. `KINLOOP_LLM_MODEL`
4. `KINLOOP_ASR_MODEL`
5. `KINLOOP_ASR_BASE_URL`（默认跟随 `LLM_BASE_URL`）
6. `KINLOOP_ASR_API_KEY`（默认跟随 `LLM_API_KEY`）
7. `KINLOOP_VOLC_ASR_APP_ID`
8. `KINLOOP_VOLC_ASR_ACCESS_TOKEN`
9. `KINLOOP_VOLC_ASR_RESOURCE_ID`（默认 `volc.bigasr.auc_turbo`）

> 注：`KINLOOP_ASR_BASE_URL` / `KINLOOP_ASR_API_KEY` 当前仅在 `server/config.mjs` 定义，`server/routes/asrRoutes.mjs` 现阶段仍直接使用 `LLM_BASE_URL` / `LLM_API_KEY`。

### 14.3 情绪识别（动态约定）
按 source 维度支持：
1. `KINLOOP_EMOTION_<SOURCE>_PROVIDER`
2. `KINLOOP_EMOTION_<SOURCE>_ENDPOINT`
3. `KINLOOP_EMOTION_<SOURCE>_API_KEY`
4. `KINLOOP_EMOTION_<SOURCE>_SECRET_KEY`
5. `KINLOOP_EMOTION_<SOURCE>_TIMEOUT_MS`
6. `KINLOOP_EMOTION_TIMEOUT_MS`（全局默认）

`<SOURCE>` 主要为 `TEXT / FACE / VOICE_TONE`。

### 14.4 前端构建变量
1. `VITE_VOLCANO_API_KEY`
2. `VITE_VOLCANO_ACCOUNT`

---

## 15. 启动与调试手册

### 15.1 本地启动顺序
1. 终端 A：`npm run dev:api`
2. 终端 B：`npm run dev`
3. 打开 `http://127.0.0.1:5173`

### 15.2 常见调试入口
1. 健康检查：`GET /api/health`
2. 会话卡片：`GET /api/conversations/cards`
3. 情绪试跑：`POST /api/emotions/analyze`
4. ASR试跑：`POST /api/asr/transcribe`

### 15.3 关键运行文件
1. API 入口：`server/index.mjs`
2. DB schema：`server/db/schema.mjs`
3. 前端总路由：`src/app/router.tsx`
4. 语音助手：`src/components/elder/ElderVoiceAssistant.tsx`
5. 家人今日状态：`src/pages/family/FamilyTodayPage.tsx`

---

## 16. 已知问题与技术债（必须知晓）

1. **编码规范已统一，但仍有少量历史乱码文本残留（2026-04-09 复核）**  
   - 已完成仓库文本文件 UTF-8 有效性扫描，并将 BOM 文件统一为 UTF-8（无 BOM）。  
   - 已新增 `.editorconfig` 与 `.gitattributes` 约束后续提交编码与行尾风格。  
   - 仍发现历史乱码文本示例：`src/components/family/FamilyChatListView.tsx`（注释与加载文案）。

2. **路由模块存在“定义但未挂载”**  
   - `server/routes/aiIntentRoutes.mjs`、`server/routes/volcanoRoutes.mjs` 当前未在 `server/index.mjs` 注册。  
   - 现状：意图走 `index.mjs` 内联实现，Volcano 代理路由未生效。

3. **`ElderVoiceAssistant` 中 ASR 分支存在提前 return**  
   - 在 `transcribeRecordedAudio` 内，浏览器转写失败后会提前 `return`，后续 server ASR 代码不可达。  
   - 影响：服务端 ASR 兜底路径实际未执行。

4. **聊天链路双轨并存**  
   - REST+SQLite 与 WS+IndexedDB 两套逻辑并存，演进中易导致认知混乱。  
   - 建议后续统一单一主链路，另一套明确退役策略。

5. **权限策略目前偏“数据展示”，非严格鉴权**  
   - `permission_policies` 可读，但服务端没有细粒度权限拦截。

6. **遗留组件与主路由存在脱节**  
   - `ElderChatListView` / `FamilyChatListView` 仍依赖旧的本地存储会话模型（`chatApi.getConversations`），且未接入当前主路由主链路。  
   - 接手时应优先以 `conversationApi` + `/api/conversations/*` 为准，旧组件按需清理或重接。

---

## 17. 对新 AI 的接手指南（实操）

### 17.1 如果要改“老人语音助手”
先看：
1. `src/components/elder/ElderVoiceAssistant.tsx`
2. `src/domain/elderVoice.ts`
3. `src/services/api/aiIntentApi.ts`
4. `server/index.mjs` 的 `/api/ai/elder-intent`

### 17.2 如果要改“聊天与通话”
先看：
1. `src/pages/elder/ElderConversationPage.tsx`
2. `src/pages/family/FamilyConversationPage.tsx`
3. `src/services/webrtc/WebRTCManager.ts`
4. `src/services/api/chatApi.ts`
5. `server/index.mjs` WS 段 + `/api/conversations/*`

### 17.3 如果要改“情绪与今日状态”
先看：
1. `server/services/emotion/emotionService.mjs`
2. `server/services/emotion/adapters/*.mjs`
3. `server/repositories/pulseRepository.mjs`
4. `src/pages/family/FamilyTodayPage.tsx`
5. `src/pages/family/FamilyStatusPage.tsx`

### 17.4 如果要改“协作与求助闭环”
先看：
1. `server/repositories/alertRepository.mjs`
2. `server/repositories/followupRepository.mjs`
3. `src/pages/elder/ElderHelpPage.tsx`
4. `src/pages/family/FamilyCollaborationPage.tsx`

---

## 18. 建议的后续技术收敛路线

1. 收敛意图路由：统一使用 `registerAiIntentRoutes`，去掉 `index.mjs` 内联重复实现。
2. 收敛 Volcano 路由：明确是否启用，启用就在入口注册并补回归用例。
3. 修复 ASR 可达性：去掉 `ElderVoiceAssistant` 中提前 return，恢复服务端兜底。
4. 持续执行编码规范：新增文件保持 UTF-8（无 BOM），避免编辑器写入 BOM/本地编码漂移。
5. 明确消息主链：REST 或 WS 选主，另一套降级或退役。
6. 增加鉴权层：把 `permission_policies` 从展示升级为服务端实际授权控制。

---

## 19. 一句话总括（给下一位接手者）

Kinloop 当前是一个“本地优先的家庭关怀全栈原型”，主干可跑通（聊天、情绪、求助、协作、语音意图），但处于快速迭代中，仍有少量历史乱码文本与双实现并存问题；接手时优先做“链路收敛 + 遗留文本清理 + 路由统一”，可显著提高可维护性。
