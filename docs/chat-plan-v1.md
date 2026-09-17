# 聊天功能实施计划（Plan）v1

## 版本信息
- **版本号**: 1.0
- **基于**: chat-prd-v1.md
- **状态**: 实施中
- **更新时间**: 2026-04-05

---

## 1. 实施阶段分解

### Phase 1: 基础架构与数据层（Week 1）
- [ ] 消息存储管理（IndexedDB）
- [ ] API 类型定义
- [ ] WebRTC 管理器框架
- [ ] 消息 API 层

### Phase 2: UI 层基础组件（Week 2）
- [ ] 聊天列表（可复用核心，家族分化）
- [ ] 聊天气泡（可复用）
- [ ] 输入框组件（家族分化）
- [ ] 聊天详情页（子女端+老人端）

### Phase 3: 通话功能（Week 2-3）
- [ ] WebRTC Signaling 客户端
- [ ] 语音通话 UI（子女端+老人端）
- [ ] 视频通话 UI（子女端+老人端）
- [ ] 弱网自适应处理

### Phase 4: 集成与优化（Week 3）
- [ ] 消息推送通知系统
- [ ] 页面路由集成
- [ ] 同机多端测试支持
- [ ] Bug Fix & 性能优化

---

## 2. 文件结构详细规划

### 2.1 新建文件清单

#### 2.1.1 存储层
```
src/utils/storage.ts
  ├─ 函数: initDB()                   // 初始化 IndexedDB
  ├─ 函数: saveMessage(msg)           // 保存单条消息
  ├─ 函数: getMessages(userId, limit) // 获取对话消息
  ├─ 函数: deleteConversation(userId) // 逻辑删除对话
  ├─ 函数: searchMessages(keyword)    // 关键词搜索
  └─ 类型: IMessage, IConversation
```

#### 2.1.2 API 层
```
src/services/api/chatApi.ts
  ├─ 函数: sendMessage(msg)           // 发送消息 WebSocket
  ├─ 函数: getOfflineMessages()       // 拉取离线消息
  ├─ 函数: markAsRead(messageIds)     // 标记已读
  ├─ 函数: fetchConversationList()    // 获取对话列表
  └─ 类型已在 types.ts 中定义

src/services/api/callApi.ts   [新建]
  ├─ 函数: sendCallSignal(signal)     // 发送通话信令
  ├─ 函数: rejectCall(callId)         // 拒接
  └─ 类型: ICallSignal, ICallOffer 等
```

#### 2.1.3 WebRTC 层
```
src/services/webrtc/WebRTCManager.ts
  ├─ 类: WebRTCManager
  ├─ 方法: initiateCall(userId, type) // 发起通话（voice/video）
  ├─ 方法: acceptCall(offer)          // 接听通话
  ├─ 方法: answerCall(answer)         // 发送应答
  ├─ 方法: addIceCandidate(candidate) // 添加 ICE
  ├─ 方法: hangup()                   // 挂断
  ├─ 方法: getStats()                 // 获取连接统计（用于判断网络质量）
  ├─ 事件: on('connected', cb)
  ├─ 事件: on('disconnected', cb)
  └─ 事件: on('error', cb)

src/services/webrtc/SignalingClient.ts
  ├─ 类: SignalingClient (extends WebSocket)
  ├─ 方法: connect()                  // 连接 WebSocket
  ├─ 方法: sendOffer(userId, offer)   // 发送 Offer
  ├─ 方法: sendAnswer(userId, answer) // 发送 Answer
  ├─ 方法: sendIceCandidate(...)      // 发送 ICE
  └─ 事件: 'offer', 'answer', 'ice'

src/services/webrtc/NetworkAdapt.ts
  ├─ 类: NetworkAdapter
  ├─ 方法: analyzeStats(stats)        // 分析网络质量
  ├─ 方法: getQualityLevel()          // 返回质量等级
  └─ 方法: applyQuality(pc, level)    // 调整连接参数
```

#### 2.1.4 组件层 - 聊天共用
```
src/components/chat/ChatList.tsx
  ├─ Props: 
  │   ├─ conversations: []
  │   ├─ selectedId?: string
  │   ├─ onSelectConversation: (id) => void
  │   ├─ isFamilyStyle?: boolean (用于样式差异)
  │   └─ onDelete?: (id) => void
  └─ 返回: JSX

src/components/chat/ChatMessage.tsx
  ├─ Props:
  │   ├─ message: IMessage
  │   ├─ isMine: boolean             // 是否是我发的
  │   ├─ isFamilyStyle?: boolean     // 样式风格
  │   └─ onLongPress?: () => void
  └─ 返回: JSX

src/components/chat/ChatInput.tsx
  ├─ Props:
  │   ├─ onSendMessage: (text) => void
  │   ├─ onSendVoice?: (blob, duration) => void
  │   ├─ isFamilyStyle?: boolean
  │   ├─ isRecording?: boolean
  │   └─ onVoiceStart/onVoiceEnd?
  └─ 返回: JSX

src/components/chat/ContactList.tsx
  ├─ Props:
  │   ├─ contacts: User[]
  │   ├─ onSelectContact: (user) => void
  │   ├─ isFamilyStyle?: boolean
  │   └─ showCallButtons?: boolean
  └─ 返回: JSX
```

#### 2.1.5 组件层 - 通话
```
src/components/chat/VoiceCall.tsx
  ├─ Props:
  │   ├─ remoteUser: User
  │   ├─ callState: 'ringing' | 'connected' | 'ended'
  │   ├─ duration: number
  │   ├─ onAccept: () => void
  │   ├─ onReject: () => void
  │   ├─ onHangup: () => void
  │   ├─ onToggleMute: (isMuted) => void
  │   ├─ onToggleSpeaker: (isSpeaker) => void
  │   ├─ isFamilyStyle?: boolean
  │   └─ isIncoming: boolean
  └─ 返回: JSX 全屏通话界面

src/components/chat/VideoCall.tsx
  ├─ Props:
  │   ├─ remoteUser: User
  │   ├─ remoteStream: MediaStream
  │   ├─ localStream: MediaStream
  │   ├─ callState: string
  │   ├─ duration: number
  │   ├─ onAccept: () => void
  │   ├─ onReject: () => void
  │   ├─ onHangup: () => void
  │   ├─ onToggleMute: (isMuted) => void
  │   ├─ onToggleCamera: (isOn) => void
  │   ├─ onSwitchDevice?: () => void
  │   ├─ isFamilyStyle?: boolean
  │   └─ isIncoming: boolean
  └─ 返回: JSX 全屏视频通话界面

src/components/chat/CallNotification.tsx
  ├─ Props:
  │   ├─ incoming: IIncomingCall
  │   ├─ onAccept: () => void
  │   ├─ onReject: () => void
  │   ├─ isFamilyStyle?: boolean
  │   └─ callType: 'voice' | 'video'
  └─ 返回: JSX 来电弹窗
```

#### 2.1.6 组件层 - 家族分化
```
src/components/family/FamilyChatListView.tsx
  ├─ 继承: ChatList (高级样式)
  ├─ 特性:
  │   ├─ 搜索框
  │   ├─ 快速拨号图标
  │   ├─ 长按删除菜单
  │   └─ 未读数红点
  └─ 返回: JSX

src/components/family/FamilyChatDetailView.tsx
  ├─ Props: { userId: string }
  ├─ 包含:
  │   ├─ 头部 (名字 + 📞📹 快捷)
  │   ├─ 消息列表
  │   ├─ ChatInput (文字输入)
  │   ├─ VoiceCall/VideoCall (全屏模态)
  │   └─ 消息已读状态显示
  └─ 返回: JSX

src/components/family/FamilyCallUI.tsx [可选]
  └─ 子女端特殊通话 UI

src/components/elder/ElderChatListView.tsx
  ├─ 继承: ChatList (简化样式)
  ├─ 特性:
  │   ├─ 超大字体 (24px+)
  │   ├─ 超大头像
  │   ├─ 2-3 个主要联系人
  │   ├─ 快捷 📞📹 按钮
  │   └─ 最少化交互
  └─ 返回: JSX

src/components/elder/ElderChatDetailView.tsx
  ├─ Props: { userId: string }
  ├─ 包含:
  │   ├─ 简化头部 (仅名字)
  │   ├─ 大消息气泡
  │   ├─ 预设快捷语按钮
  │   ├─ 语音输入按钮
  │   ├─ VoiceCall/VideoCall (全屏模态)
  │   └─ 无已读状态显示
  └─ 返回: JSX

src/components/elder/ElderCallUI.tsx [可选]
  └─ 老人端特殊通话 UI (简化界面)
```

#### 2.1.7 页面层
```
src/pages/family/FamilyChatsPage.tsx
  ├─ 修改:
  │   ├─ 导入 FamilyChatListView
  │   ├─ Redux/Context 连接
  │   └─ 路由跳转到 FamilyChatDetailPage
  └─ 返回: JSX

src/pages/family/FamilyChatDetailPage.tsx [新建]
  ├─ 路由: /family/chats/:userId
  ├─ 包含:
  │   ├─ FamilyChatDetailView
  │   ├─ WebRTC 连接管理
  │   ├─ 消息同步
  │   └─ 通话逻辑
  └─ 返回: JSX

src/pages/elder/ElderChatsPage.tsx
  ├─ 修改:
  │   ├─ 导入 ElderChatListView (替换现有)
  │   └─ 路由跳转升级
  └─ 返回: JSX

src/pages/elder/ElderChatDetailPage.tsx [新建]
  ├─ 路由: /elder/chats/:userId
  ├─ 包含:
  │   ├─ ElderChatDetailView
  │   ├─ WebRTC 连接管理
  │   ├─ 简化的消息同步
  │   └─ 简化的通话逻辑
  └─ 返回: JSX
```

#### 2.1.8 域层（文案/常量）
```
src/domain/content/chatPrompts.ts [新建]
  ├─ PRESET_MESSAGES_FAMILY[]       // 子女端快捷语
  ├─ PRESET_MESSAGES_ELDER[]        // 老人端快捷语
  ├─ CALL_STATES (i18n key)
  ├─ MESSAGE_TYPES (i18n key)
  └─ ERROR_MESSAGES {}

src/domain/content/callGuidance.ts [新建]
  ├─ NETWORK_QUALITY_LABELS{}       // 网络质量文案
  ├─ CALL_TIMEOUT (ms)
  ├─ ICE_TIMEOUT (ms)
  └─ VIDEO_QUALITY_PRESETS (720p/360p...)
```

#### 2.1.9 工具层
```
src/utils/dateTime.ts [修改]
  ├─ 添加: formatCallDuration(ms)   // 格式化通话时长
  └─ 添加: formatMessageTime(ts)    // 格式化消息时间

src/utils/notification.ts [新建]
  ├─ 函数: requestNotificationPermission()
  ├─ 函数: showNotification(title, options)
  ├─ 函数: closeNotification(tag)
  └─ 类型: INotificationOptions

src/utils/webrtc.ts [新建]
  ├─ 函数: getLocalStream(audio, video)
  ├─ 函数: stopLocalStream(stream)
  ├─ 函数: getDevices(kind?)
  └─ 函数: setAudioOutput(deviceId)
```

#### 2.1.10 样式文件
```
src/components/chat/ChatList.module.css
src/components/chat/ChatMessage.module.css
src/components/chat/ChatInput.module.css
src/components/family/FamilyChatDetailView.module.css
src/components/family/FamilyChatListView.module.css
src/components/elder/ElderChatDetailView.module.css
src/components/elder/ElderChatListView.module.css
src/components/chat/VoiceCall.module.css
src/components/chat/VideoCall.module.css
```

### 2.2 修改的文件清单

#### 2.2.1 API 层修改
```
src/services/api/types.ts
  ├─ 添加界面:
  │   ├─ interface IMessage
  │   ├─ interface IConversation
  │   ├─ interface ICallSignal
  │   ├─ interface IUser (扩展)
  │   ├─ interface INotification
  │   └─ enum MessageStatus
  
src/services/api/index.ts
  └─ 导出新的 API 接口
  
src/services/api/client.ts
  ├─ 修改:
  │   ├─ 添加 WebSocket 连接管理
  │   ├─ 订阅消息事件
  │   ├─ 心跳检测
  │   └─ 自动重连
```

#### 2.2.2 路由修改
```
src/app/router.tsx
  ├─ 添加:
  │   ├─ Route path="/family/chats/:userId"
  │   ├─ Route path="/elder/chats/:userId"
  │   └─ 可选: 通话浮窗路由
  
src/pages/family/FamilyChatsPage.tsx
  └─ 升级到新 UI 组件

src/pages/elder/ElderChatsPage.tsx [已存在]
  └─ 升级到新 UI 组件
```

#### 2.2.3 样式修改
```
src/index.css
  ├─ 添加:
  │   ├─ CSS 变量 (老人端字体大小)
  │   └─ 全局 WebRTC 样式 (video, audio)

src/app/app.css [可选]
  └─ 通话浮窗样式
```

#### 2.2.4 主文件修改
```
src/main.tsx
  ├─ 添加:
  │   ├─ 初始化 IndexedDB
  │   ├─ 初始化通知权限请求
  │   ├─ WebSocket 连接
  │   └─ 全局错误处理
```

---

## 3. 文件编辑详细步骤

### Phase 1.1：创建存储管理（src/utils/storage.ts）

**目标**: 实现 IndexedDB 消息持久化
**步骤**:
1. 定义 IMessage, IConversation 类型
2. 创建 DB schema (conversations, messages 表)
3. 实现 CRUD 函数
4. 处理数据迁移逻辑

**代码框架**:
```typescript
interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  type: 'text' | 'image' | 'voice';
  status: 'sending' | 'sent' | 'delivered' | 'read';
  timestamp: number;
  isDeleted?: boolean;
}

class MessageStore {
  private db: IDBDatabase;
  
  async init() { }
  async saveMessage(msg: IMessage) { }
  async getMessages(conversationId: string, limit: number) { }
  async markAsRead(messageIds: string[]) { }
  async deleteConversation(conversationId: string) { }
  async searchMessages(query: string) { }
}
```

### Phase 1.2：扩展 API 类型定义（src/services/api/types.ts）

**目标**: 统一消息和通话的类型
**步骤**:
1. 添加 IMessage, IConversation 接口
2. 添加 ICallSignal, ICallOffer, ICallAnswer 接口
3. 添加 IUser 扩展字段（在线状态等）
4. 添加通知类型

### Phase 1.3：创建聊天 API 层（src/services/api/chatApi.ts）

**目标**: 消息收发的 API 封装
**步骤**:
1. 定义 sendMessage() 通过 WebSocket 推送
2. 定义 getOfflineMessages() 拉取服务端离线消息
3. 定义 markAsRead() 标记消息已读
4. 定义 fetchConversationList() 获取对话列表

### Phase 1.4：创建通话 API 层（src/services/api/callApi.ts）

**目标**: 通话信令的 API 封装
**步骤**:
1. 定义 sendCallSignal() 通过 WebSocket 发送信令
2. 定义 rejectCall(), hangupCall() 等控制

### Phase 1.5：修改客户端连接（src/services/api/client.ts）

**目标**: 升级 WebSocket 支持消息和通话信令
**步骤**:
1. 添加消息事件监听
2. 添加通话信令事件监听
3. 添加心跳检测
4. 添加自动重连机制
5. 绑定本地存储

---

继续到 **Phase 2：WebRTC 基础架构**

### Phase 2.1：创建 WebRTC 管理器（src/services/webrtc/WebRTCManager.ts）

**目标**: 管理 WebRTC 连接生命周期
**步骤**:
1. 定义 WebRTCManager 类
2. 实现 initiateCall() - 发起通话
3. 实现 acceptCall() - 接听通话
4. 实现 answerCall() - 发送答案
5. 实现 addIceCandidate() - 处理 ICE
6. 实现 hangup() - 挂断
7. 发出事件 (connected, disconnected, error)

**关键配置**:
```typescript
const RTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // 可选: TURN 服务器（付费）
  ]
};
```

### Phase 2.2：创建 Signaling 客户端（src/services/webrtc/SignalingClient.ts）

**目标**: WebSocket 信令通道
**步骤**:
1. 继承 WebSocket 或包装现有连接
2. 实现 sendOffer() 发送 SDP Offer
3. 实现 sendAnswer() 发送 SDP Answer
4. 实现 sendIceCandidate() 发送 ICE
5. 监听 'offer', 'answer', 'ice' 事件

### Phase 2.3：创建网络适应器（src/services/webrtc/NetworkAdapt.ts）

**目标**: 根据网络质量自动调整视频质量
**步骤**:
1. 实现 analyzeStats() 从 RTCPeerConnection.getStats() 提取信息
2. 计算丢包率、延迟、带宽
3. 实现 getQualityLevel() 返回 'high' | 'medium' | 'low'
4. 实现 applyQuality() 修改 RTCRtpSender 的参数

**质量判断逻辑**:
```
丢包率 < 2% && RTT < 100ms → high (1080p/30fps)
丢包率 2-5% || RTT 100-300ms → medium (720p/30fps)
丢包率 > 5% || RTT > 300ms → low (360p/15fps)
```

---

继续到 **Phase 3：UI 组件**

### Phase 3.1：创建可复用 ChatList 组件

**目标**: 聊天列表 UI（支持家族差异）
**步骤**:
1. 设计组件 Props interface
2. 在家族模式下使用 24px 字体、大头像
3. 在普通模式下使用 14px 字体
4. 支持长按删除、快捷拨号
5. 显示未读数和最后消息预览

### Phase 3.2：创建 ChatMessage 气泡组件

**目标**: 消息气泡 UI（支持多种类型）
**步骤**:
1. 支持左/右对齐（对方/我）
2. 支持文字、图片、语音消息类型
3. 显示状态标识（已读/未读）
4. 支持长按菜单（转发、删除等）

### Phase 3.3：创建 ChatInput 输入框组件

**目标**: 输入框及快捷按钮
**步骤**:
1. 子女端：图片+表情+语音+文字输入
2. 老人端：预设快捷语+语音输入
3. 支持语音按住录音（按住发送，抬起取消）
4. 自动换行、Markdown 支持（可选）

### Phase 3.4：创建通话 UI 组件

**目标**: VoiceCall + VideoCall 组件
**步骤**:
1. 创建 VoiceCall.tsx - 语音通话界面
   - 来电方：显示对方名字、"呼叫中..."
   - 接听后：显示通话时长、静音/扬声器按钮
   - 挂断按钮
2. 创建 VideoCall.tsx - 视频通话界面
   - 显示远程视频（80%）+ 本地小窗（20%）
   - 静音、切换摄像头、挂断
3. 支持家族差异（按钮大小、字体等）

### Phase 3.5：创建来电通知弹窗

**目标**: CallNotification 组件
**步骤**:
1. 显示来电者名字和头像
2. 接听/拒绝按钮
3. 全屏覆盖（高优先级）
4. 支持铃声（可选）

### Phase 3.6：创建页面集成组件

**目标**: FamilyChatDetailView + ElderChatDetailView
**步骤**:
1. FamilyChatDetailView：
   - 包含 ChatList + 聊天气泡
   - 支持消息发送、接收、标记已读
   - 支持语音/视频通话浮窗
2. ElderChatDetailView：
   - 简化版，大字体
   - 预设快捷语
   - 快捷拨号按钮

---

继续到 **Phase 4：路由与集成**

### Phase 4.1：修改路由（src/app/router.tsx）

**目标**: 添加聊天详情页路由
**步骤**:
1. 添加 FamilyChatDetailPage 路由：`/family/chats/:userId`
2. 添加 ElderChatDetailPage 路由：`/elder/chats/:userId`
3. 可选：通话浮窗路由

### Phase 4.2：推送通知系统（src/utils/notification.ts）

**目标**: 离线/在线推送
**步骤**:
1. 请求通知权限
2. 实现 showNotification() 显示系统通知
3. 处理消息推送事件
4. 处理来电通知事件

### Phase 4.3：同机多端测试支持

**目标**: 支持同一台电脑测试两个端
**步骤**:
1. 使用 localStorage 区分用户身份
2. 一个标签页模拟用户 A（family 端）
3. 另一个标签页模拟用户 B（elder 端）
4. 支持虚拟摄像头（OBS、ManyCam 等）

---

## 4. 实施依赖关系图

```
存储管理 (storage.ts)
    ↓
API 类型定义 (types.ts)
    ├─ 消息 API (chatApi.ts) ← 存储管理
    └─ 通话 API (callApi.ts)
        ↓
    WebSocket 连接 (client.ts) ← 消息/通话 API
        ├─ WebRTC 管理器 (WebRTCManager.ts)
        │   └─ Signaling 客户端 (SignalingClient.ts)
        │   └─ 网络适应器 (NetworkAdapt.ts)
        │
        ├─ UI 组件
        │   ├─ ChatList
        │   ├─ ChatMessage
        │   ├─ ChatInput
        │   ├─ VoiceCall/VideoCall
        │   ├─ CallNotification
        │   └─ 页面（FamilyChatDetail, ElderChatDetail）
        │
        ├─ 推送通知 (notification.ts)
        └─ 页面集成 (router.tsx)
```

---

## 5. 测试用例编写指南

### 5.1 单元测试
- MessageStore 的 CRUD 操作
- WebRTC 的信令流程
- 网络质量判断算法
- 时间格式化函数

### 5.2 集成测试
- 完整消息发送流程
- 完整语音通话流程
- 完整视频通话流程
- 离线消息同步

### 5.3 端到端测试
- 同机两标签页通话
- 局域网两台设备通话
- 弱网降质流程
- 断网恢复流程

---

## 6. 风险点与缓解

| 风险 | 缓解 |
|------|------|
| ICE 连接失败 | 配置 TURN 服务器、超时重试 |
| 摄像头权限被拒 | 友好提示，允许手动启用 |
| 消息存储爆炸 | 监控 IndexedDB 大小，提示清理 |
| WebSocket 断连 | 自动重连，离线消息队列 |
| 浏览器兼容性 | 测试 Chrome/Edge/Safari |

---

## 7. 交付检查清单

### Phase 1 完成标准
- [ ] IndexedDB 消息存储可用
- [ ] API 类型定义完整
- [ ] WebSocket 连接稳定
- [ ] 消息发送/接收基本流程 OK

### Phase 2 完成标准
- [ ] WebRTC 连接建立成功
- [ ] 语音/视频通话可用
- [ ] 网络质量判断逻辑正确
- [ ] 同机两标签页可互通

### Phase 3 完成标准
- [ ] ChatList/ChatMessage 组件完整
- [ ] VoiceCall/VideoCall UI 完整
- [ ] FamilyChatDetailView 完整
- [ ] ElderChatDetailView 完整

### Phase 4 完成标准
- [ ] 路由集成完成
- [ ] 推送通知系统运作
- [ ] 所有测试用例 Pass
- [ ] Build 无错误

---

## 8. 后续优化方向

- [ ] 消息加密（E2EE）
- [ ] 群聊支持
- [ ] 消息搜索展滑动
- [ ] 通话录音
- [ ] 消息备份到云端
- [ ] 弱网自动降质的更精细控制
- [ ] 通话中的屏幕共享（future）

