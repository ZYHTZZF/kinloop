# 聊天功能开发计划 v1

## 1. 功能划分

### 1.1 子女端（Family Chat）
- **聊天列表页面** - 显示所有对话、最后消息、未读数
- **单个聊天页面** - 支持文字、图片、语音、视频
- **消息气泡** - 区分左右，显示时间、已读状态
- **输入框** - 支持多种输入方式（文字、语音、视频）
- **语音聊天** - 一对一实时语音通话
- **视频聊天** - 一对一实时视频通话
- **联系人管理** - 显示家庭成员，快速拨号

### 1.2 老人端（Elder Chat）
- **简化聊天列表** - 大字体、大按钮、清晰布局
- **简化聊天页面** - 消息大、易读、最少化交互
- **一键拨号** - 减少输入，支持快速启动语音/视频
- **语音输入优先** - 主要交互方式是语音
- **视频通话** - 简化的视频接听界面
- **字体/图标** - 老年友好的设计

---

## 2. 技术架构

### 2.1 前端技术栈
- **React + TypeScript** - UI 框架
- **实时通信**
  - WebSocket - 消息同步
  - WebRTC - 语音/视频通话（P2P）
  - 备选：Signaling Server 处理 ICE/STUN
- **消息存储** - IndexedDB（本地缓存）+ API（服务端）
- **音视频处理**
  - getUserMedia() - 获取摄像头/麦克风
  - RTCPeerConnection - 建立点对点连接
  - 库：simple-peer、webrtc-adapter

### 2.2 后端需求
- **Signaling Server** - WebSocket 服务处理 SDP/ICE
- **消息服务** - 存储、转发、离线消息队列
- **用户在线状态** - 实时更新

---

## 3. 文件结构规划

```
src/
├── components/
│   ├── chat/
│   │   ├── ChatList.tsx           # 聊天列表（可复用）
│   │   ├── ChatMessage.tsx        # 消息气泡（可复用）
│   │   ├── ChatInput.tsx          # 输入框（家族分化）
│   │   ├── VoiceCall.tsx          # 语音通话（可复用）
│   │   ├── VideoCall.tsx          # 视频通话（可复用）
│   │   ├── ContactList.tsx        # 联系人列表（可复用）
│   │
│   ├── family/
│   │   ├── FamilyChatListView.tsx # 子女端列表视图
│   │   ├── FamilyChatView.tsx     # 子女端聊天页面
│   │   └── FamilyCallUI.tsx       # 子女端通话 UI
│   │
│   └── elder/
│       ├── ElderChatListView.tsx  # 老人端列表视图（简化）
│       ├── ElderChatView.tsx      # 老人端聊天页面（简化）
│       └── ElderCallUI.tsx        # 老人端通话 UI（简化）
│
├── services/
│   ├── api/
│   │   ├── chatApi.ts            # 消息 API
│   │   ├── callApi.ts            # 通话信令 API
│   │   └── types.ts              # 共享类型
│   │
│   └── webrtc/
│       ├── WebRTCManager.ts       # WebRTC 连接管理
│       ├── SignalingClient.ts     # Signaling 客户端
│       └── AudioVideoHandler.ts   # 音视频处理
│
├── domain/
│   └── content/
│       ├── chatPrompts.ts         # 聊天相关文案
│       └── callGuidance.ts        # 通话指引文案
│
└── pages/
    ├── family/
    │   ├── FamilyChatsPage.tsx    # 聊天列表页
    │   └── FamilyChatDetailPage.tsx # 聊天详情页
    │
    └── elder/
        ├── ElderChatsPage.tsx      # 聊天列表页
        └── ElderChatDetailPage.tsx # 聊天详情页
```

---

## 4. 核心流程

### 4.1 文字消息流程
```
用户输入 → 发送 → 本地存储 → WebSocket 推送 → 对方接收 → 更新 UI
```

### 4.2 语音通话流程
```
发起方点击语音 → Signaling 连接 → WebRTC 建立 → 音频传输 → 挂断
```

### 4.3 视频通话流程
```
发起方点击视频 → Signaling 连接 → WebRTC 建立（视音频） → 显示画面 → 挂断
```

---

## 5. 设计差异对比

| 功能 | 子女端 | 老人端 |
|------|-------|-------|
| 字体大小 | 14px 标准 | 18px+ 放大 |
| 按钮大小 | 44px | 60px+ |
| 输入方式 | 文字优先 + 语音快捷 | 语音优先 |
| 消息显示 | 标准气泡 + 表情 | 大气泡 + 清晰文字 |
| 联系人 | 详细列表 + 群组 | 简化列表（主要联系人） |
| 通话 UI | 标准接听界面 | 超大按钮 + 简化信息 |

---

## 6. 优先级排序

### Phase 1（MVP - 核心功能）
- [ ] 聊天列表页（家族分化）
- [ ] 聊天详情页+消息显示
- [ ] 简单文字消息收发
- [ ] WebSocket 连接与消息推送

### Phase 2（音视频基础）
- [ ] WebRTC 信令服务搭建
- [ ] 语音通话基本流程
- [ ] 视频通话基本流程
- [ ] 简化的老人端通话 UI

### Phase 3（优化体验）
- [ ] 语音输入/输出优化
- [ ] 消息已读状态
- [ ] 离线消息处理
- [ ] 通话录制/存档（可选）

### Phase 4（高级特性）
- [ ] 消息搜索
- [ ] 消息转发
- [ ] 群聊功能（future）

---

## 7. 需要确认的问题

| 问题 | 建议 |
|------|------|
| 是否需要群聊？ | 优先做一对一，群聊后续 |
| 消息加密需求？ | 完全端到端？还是传输层加密？ |
| 消息存储期限？ | 云存储 vs 本地 30 天？ |
| 视频分辨率？ | 老人端建议降低（节省带宽） |
| 通话时长限制？ | 无限制？还是有限制？ |
| 离线通知？ | 未接通话提醒？ |
| 网络条件处理？ | 自动降级、快速重连？ |

---

## 8. 下一步

1. ✅ 确认以上规划是否符合你的需求
2. ⏳ 根据反馈修改计划
3. ⏳ 生成详细的 PRD（产品需求文档）
4. ⏳ 根据 PRD 生成实施 plan（具体在哪些文件做改动）
5. ⏳ 开始编码实现
