# Kinloop Frontend Blueprint V1

## 1. 文档定位

这份文档不是产品 PRD，而是面向前端落地的实现蓝图。

它解决的是这些问题：

1. React 页面该怎么拆。
2. 路由该怎么设计。
3. 组件树怎么组织。
4. 哪些状态放页面，哪些状态放共享层。
5. 本地 API 和 SQLite 数据怎么接到页面上。
6. 当前仓库里已有的页面和模块，未来如何迁移到新的产品结构。

这份文档默认基于：

1. Web MVP
2. 本地数据库 `SQLite`
3. 本地 API
4. AI 能力先占位 / mock

---

## 2. 目标实现策略

## 2.1 技术建议

推荐前端形态：

1. React
2. TypeScript
3. React Router
4. 本地 service 层封装 API
5. 页面级状态 + 轻量共享 store

## 2.2 结构原则

1. 路由按“长辈端 / 家人端”分区。
2. 页面按“页面级容器 + 领域组件 + 共享组件”拆分。
3. 会话、回忆、状态、协作各自拥有清晰目录。
4. 避免把所有状态堆在 `App.tsx`。

## 2.3 推荐演进路线

1. 先保留当前项目的 UI 骨架与示意数据能力。
2. 再引入 React Router，替代当前 `useState` 驱动的页面切换。
3. 最后接本地 API 与 SQLite 数据。

---

## 3. 路由表

## 3.1 顶层路由

建议使用以下顶层路径：

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | 入口选择页或默认重定向 | 可重定向到 `/elder/home` 或 `/family/today` |
| `/elder/*` | 长辈端路由组 | 长辈端所有页面 |
| `/family/*` | 家人端路由组 | 家人端所有页面 |

## 3.2 长辈端路由

| 路由 | 页面名 | 说明 |
|---|---|---|
| `/elder/home` | 陪伴首页 | AI 常驻 + 家人会话带 |
| `/elder/contacts` | 联络页 | 家人会话总入口 |
| `/elder/conversations/:conversationId` | 单个家人会话页 | 和具体家人的完整会话 |
| `/elder/memories` | 回忆页 | 双端共享回忆时间线 |
| `/elder/help` | 求助页 | 联系家人 / 我不舒服 / SOS |

## 3.3 家人端路由

| 路由 | 页面名 | 说明 |
|---|---|---|
| `/family/today` | 今天页 | 默认首页，状态判断工作台 |
| `/family/status` | 状态与回访页 | Pulse + FollowupRecord 历史 |
| `/family/chats` | 聊天列表页 | 会话列表 |
| `/family/chats/:conversationId` | 单个聊天页 | 和长辈的具体会话 |
| `/family/memories` | 回忆页 | 双端共享回忆时间线 |
| `/family/collaboration` | 协作页 | Circle of Care 工作台 |

## 3.4 推荐跳转关系

### 长辈端
1. `/elder/home` -> `/elder/conversations/:conversationId`
2. `/elder/home` -> `/elder/memories`
3. `/elder/home` -> `/elder/help`
4. `/elder/contacts` -> `/elder/conversations/:conversationId`

### 家人端
1. `/family/today` -> `/family/chats/:conversationId`
2. `/family/today` -> `/family/status`
3. `/family/today` -> `/family/collaboration`
4. `/family/chats` -> `/family/chats/:conversationId`

---

## 4. 页面结构与组件树

## 4.1 应用级组件树

```text
App
├─ AppRouter
│  ├─ ElderAppLayout
│  │  ├─ ElderBottomNav
│  │  ├─ ElderGlobalVoiceButton
│  │  └─ Routed Page
│  └─ FamilyAppLayout
│     ├─ FamilyBottomNav
│     └─ Routed Page
├─ OverlayHost
│  ├─ AiConfirmSheet
│  ├─ MemoryAddConfirmDialog
│  ├─ SosCountdownDialog
│  └─ InviteApproveDialog
└─ ToastHost
```

说明：

1. `ElderGlobalVoiceButton` 只在长辈端布局中常驻。
2. 各类确认浮层不要散落在页面里，尽量由统一 `OverlayHost` 管理。
3. 家人端没有全局大语音按钮，所以布局更简单。

---

## 4.2 长辈端页面与组件树

## 4.2.1 `/elder/home` 陪伴首页

```text
ElderHomePage
├─ ElderTopStatusBar
│  ├─ TimeDisplay
│  ├─ WeatherBadge
│  └─ DateText
├─ ElderAiPresencePanel
│  ├─ AiGlowAvatar
│  ├─ AiPromptText
│  └─ AiQuickHint
├─ ConversationStripSection
│  ├─ ConversationStripHeader
│  ├─ ConversationStrip
│  │  ├─ ConversationCard
│  │  │  ├─ FamilyAvatar
│  │  │  ├─ FamilyName
│  │  │  ├─ PrimaryContentRenderer
│  │  │  │  ├─ TextPreviewCard
│  │  │  │  ├─ PhotoPreviewCard
│  │  │  │  └─ VoicePreviewCard
│  │  │  ├─ UnreadSummaryBadge
│  │  │  └─ StatusDot
│  │  ├─ StripPrevButton
│  │  └─ StripNextButton
│  └─ StripHintText
└─ ElderBottomNavSpacer
```

页面职责：

1. 不展示完整消息列表。
2. 只展示 AI 在场感和家人会话带。
3. 作为长辈端所有主流程的起点。

关键交互：

1. 点击卡片主内容 -> 消费当前消息。
2. 点击头像或名字 -> 进入单人会话页。
3. 长按全局语音按钮 -> 直接语音导航。

## 4.2.2 `/elder/contacts` 联络页

```text
ElderContactsPage
├─ ContactsPageHeader
│  ├─ PageTitle
│  └─ SearchTrigger
├─ ContactConversationList
│  ├─ ContactConversationRow
│  │  ├─ FamilyAvatar
│  │  ├─ FamilyMeta
│  │  ├─ LatestRealContentPreview
│  │  └─ UnreadIndicator
│  └─ EmptyContactsState
└─ ElderBottomNavSpacer
```

页面职责：

1. 展示所有家人会话。
2. 让长辈主动找人。

## 4.2.3 `/elder/conversations/:conversationId` 单个家人会话页

```text
ElderConversationPage
├─ ElderConversationHeader
│  ├─ BackButton
│  ├─ FamilyAvatar
│  └─ FamilyName
├─ ElderMessageList
│  ├─ MessageDayDivider
│  ├─ FamilyMessageBubble
│  │  ├─ MessageContentRenderer
│  │  ├─ AddToMemoryButton
│  │  └─ ReadStateHint
│  └─ ElderMessageBubble
│     ├─ MessageContentRenderer
│     └─ AiDraftedTag
├─ ElderConversationAiAssistHint
└─ ElderBottomNavSpacer
```

说明：

1. AI 代发确认浮层不建议写死在页面里，交由 `AiConfirmSheet` 管理。
2. 这个页面一定要和“AI 闲聊态”视觉区分开。

## 4.2.4 `/elder/memories` 回忆页

```text
ElderMemoriesPage
├─ MemoriesPageHeader
├─ MemoryTimeline
│  ├─ MemoryMonthGroup
│  ├─ MemoryCard
│  │  ├─ MemoryMedia
│  │  ├─ MemoryText
│  │  ├─ MemoryMeta
│  │  └─ MemoryActionRow
│  └─ EmptyMemoryState
└─ ElderBottomNavSpacer
```

## 4.2.5 `/elder/help` 求助页

```text
ElderHelpPage
├─ HelpPageHeader
├─ HelpActionGroup
│  ├─ ContactFamilyHelpCard
│  ├─ UnwellHelpCard
│  └─ SosHelpCard
│     ├─ SosButton
│     └─ SosHoldProgress
├─ HelpHintText
└─ ElderBottomNavSpacer
```

---

## 4.3 家人端页面与组件树

## 4.3.1 `/family/today` 今天页

```text
FamilyTodayPage
├─ FamilyTodayHeader
│  ├─ ElderNameTitle
│  └─ PendingBadge
├─ ActionSuggestionSection
│  ├─ ActionSuggestionCard
│  │  ├─ SuggestionTitle
│  │  ├─ SuggestionReason
│  │  └─ SuggestionActions
├─ CurrentStatusSection
│  ├─ TodayStatusCard
│  │  ├─ InteractionCount
│  │  ├─ MoodSummary
│  │  ├─ TopicTags
│  │  └─ AlertFlag
├─ PulseStreamSection
│  ├─ SectionHeader
│  │  └─ ViewAllStatusLink
│  ├─ PulseList
│  │  ├─ PulseRow
│  │  │  ├─ PulseSeverityDot
│  │  │  ├─ PulseSummary
│  │  │  ├─ PulseTime
│  │  │  └─ ClaimAction
│  └─ EmptyPulseState
└─ FamilyBottomNavSpacer
```

页面职责：

1. 先判断今天发生了什么。
2. 再引导家人执行动作。
3. 不直接退化为聊天列表。

## 4.3.2 `/family/status` 状态与回访页

```text
FamilyStatusPage
├─ StatusPageHeader
├─ WeeklyTrendPanel
├─ PulseFollowupTimeline
│  ├─ DateGroup
│  ├─ PulseTimelineItem
│  │  ├─ PulseMeta
│  │  ├─ PulseSummary
│  │  └─ FollowupGroup
│  │     ├─ FollowupCard
│  │     │  ├─ ResultTag
│  │     │  ├─ ResultNote
│  │     │  └─ HandlerMeta
│  └─ EmptyStatusHistory
└─ FamilyBottomNavSpacer
```

## 4.3.3 `/family/chats` 聊天列表页

```text
FamilyChatsPage
├─ ChatsPageHeader
│  ├─ PageTitle
│  └─ NewActionSlot
├─ ChatConversationList
│  ├─ ChatConversationRow
│  │  ├─ ElderAvatar
│  │  ├─ LatestMessagePreview
│  │  ├─ DeliveryState
│  │  └─ Timestamp
│  └─ EmptyChatState
└─ FamilyBottomNavSpacer
```

## 4.3.4 `/family/chats/:conversationId` 单个聊天页

```text
FamilyConversationPage
├─ FamilyConversationHeader
│  ├─ BackButton
│  ├─ ElderAvatar
│  └─ QuickActions
├─ FamilyMessageList
│  ├─ FamilySentBubble
│  │  ├─ MessageContentRenderer
│  │  ├─ DeliveryStateBadge
│  │  └─ AddToMemoryButton
│  └─ ElderReplyBubble
│     ├─ MessageContentRenderer
│     └─ AiDraftedTag
├─ FamilyComposer
│  ├─ TextInput
│  ├─ VoiceRecordButton
│  ├─ PhotoPickerButton
│  └─ SendButton
└─ FamilyBottomNavSpacer
```

## 4.3.5 `/family/memories` 回忆页

```text
FamilyMemoriesPage
├─ MemoriesPageHeader
├─ MemoryTimeline
│  ├─ MemoryMonthGroup
│  ├─ MemoryCard
│  │  ├─ MemoryMedia
│  │  ├─ MemoryDescription
│  │  ├─ MemorySourceMeta
│  │  ├─ ViewSourceContextButton
│  │  └─ MemoryActions
│  └─ EmptyMemoryState
└─ FamilyBottomNavSpacer
```

## 4.3.6 `/family/collaboration` 协作页

```text
FamilyCollaborationPage
├─ CollaborationPageHeader
├─ CareRelaySection
│  ├─ RecentContactCard
│  ├─ SuggestedRelayCard
│  │  ├─ SuggestedMember
│  │  ├─ RelayReason
│  │  ├─ NotifyButton
│  │  └─ OverrideButton
├─ ActiveTasksSection
│  ├─ PulseTaskCard
│  ├─ AlertTaskCard
│  └─ EmptyTaskState
├─ MembersSection
│  ├─ MemberRow
│  │  ├─ RoleBadge
│  │  ├─ MemberMeta
│  │  └─ MemberActions
├─ InviteSection
│  ├─ FamilyInviteCodeCard
│  ├─ ApprovalQueue
│  └─ GenerateInviteButton
└─ FamilyBottomNavSpacer
```

---

## 5. 推荐目录结构

建议在当前 `src` 基础上逐步重组为：

```text
src
├─ app
│  ├─ App.tsx
│  ├─ router.tsx
│  ├─ providers
│  └─ layouts
│     ├─ ElderAppLayout.tsx
│     └─ FamilyAppLayout.tsx
├─ pages
│  ├─ elder
│  │  ├─ ElderHomePage.tsx
│  │  ├─ ElderContactsPage.tsx
│  │  ├─ ElderConversationPage.tsx
│  │  ├─ ElderMemoriesPage.tsx
│  │  └─ ElderHelpPage.tsx
│  └─ family
│     ├─ FamilyTodayPage.tsx
│     ├─ FamilyStatusPage.tsx
│     ├─ FamilyChatsPage.tsx
│     ├─ FamilyConversationPage.tsx
│     ├─ FamilyMemoriesPage.tsx
│     └─ FamilyCollaborationPage.tsx
├─ features
│  ├─ ai-assistant
│  ├─ conversations
│  ├─ memories
│  ├─ pulse
│  ├─ followups
│  ├─ alerts
│  ├─ collaboration
│  └─ invite
├─ components
│  ├─ common
│  ├─ elder
│  ├─ family
│  └─ overlays
├─ services
│  ├─ api
│  ├─ ai
│  ├─ mappers
│  └─ mocks
├─ stores
│  ├─ ui
│  └─ entities
└─ types
```

---

## 6. 当前仓库与新结构映射建议

当前仓库已有这些模块：

1. `elder-talk`
2. `elder-echo`
3. `elder-help`
4. `family-care`
5. `family-status`
6. `family-followup`

建议迁移关系如下：

| 当前模块 | 建议归属 |
|---|---|
| `src/features/elder-talk` | 长辈端首页 AI 对话能力 |
| `src/features/elder-echo` | 长辈端会话带、单聊页、回忆加入相关组件 |
| `src/features/elder-help` | 长辈端求助页 |
| `src/features/family-care` | 家人端今天页中的建议动作区 |
| `src/features/family-status` | 家人端今天页和状态与回访页 |
| `src/features/family-followup` | FollowupRecord、状态回访详情 |

说明：

1. 这些旧模块不必立刻删除。
2. 可以先逐步抽组件和数据结构，减少一次性重构风险。

---

## 7. 状态归属建议

## 7.1 页面本地状态

适合放页面内部 `useState` 的状态：

1. 当前展开的卡片索引
2. 搜索词
3. 某个弹窗是否打开
4. 语音确认草稿显示状态
5. 图片预览开关

## 7.2 共享 UI 状态

适合放共享 UI store 的状态：

1. 当前端类型：长辈端 / 家人端
2. 全局语音按钮状态
3. OverlayHost 当前打开的弹层
4. toast / 提示消息

## 7.3 实体数据状态

适合放实体 store 或 query cache 的状态：

1. 当前家庭空间
2. 会话列表
3. 消息列表
4. 回忆时间线
5. Pulse 列表
6. FollowupRecord 列表
7. Alert 列表
8. 成员列表

---

## 8. 本地 API 对接建议

## 8.1 建议的前端 service 模块

```text
services/api
├─ familySpaceApi.ts
├─ conversationApi.ts
├─ memoryApi.ts
├─ pulseApi.ts
├─ followupApi.ts
├─ alertApi.ts
├─ memberApi.ts
└─ aiApi.ts
```

## 8.2 页面与 API 映射

| 页面 | 主要 API |
|---|---|
| `/elder/home` | `conversationApi.getConversationCards()` |
| `/elder/conversations/:id` | `conversationApi.getConversationDetail()` |
| `/elder/memories` | `memoryApi.listMemories()` |
| `/elder/help` | `alertApi.createAlert()` |
| `/family/today` | `pulseApi.listTodayPulses()` + `followupApi.listOpenTasks()` |
| `/family/status` | `pulseApi.listPulseHistory()` + `followupApi.listFollowups()` |
| `/family/chats/:id` | `conversationApi.getConversationDetail()` + `conversationApi.sendMessage()` |
| `/family/memories` | `memoryApi.listMemories()` + `memoryApi.addMemory()` |
| `/family/collaboration` | `memberApi.listMembers()` + `alertApi.listActiveAlerts()` |

## 8.3 AI 占位接口建议

| 接口 | 用途 |
|---|---|
| `aiApi.draftReply()` | AI 代发消息草稿 |
| `aiApi.confirmMemoryCandidate()` | AI 协助加入回忆 |
| `aiApi.interpretVoiceIntent()` | 语音导航与语音命令 |
| `aiApi.generatePulse()` | 从长辈表达生成 Pulse |
| `aiApi.interpretHelpIntent()` | 识别不舒服 / SOS 语义 |

前期可全部 mock。

---

## 9. 实现顺序建议

## 9.1 第一阶段：前端结构先站稳

目标：

1. 路由跑起来。
2. 页面壳子和底部导航跑起来。
3. 长辈端全局语音按钮常驻跑起来。

建议先做：

1. `ElderAppLayout`
2. `FamilyAppLayout`
3. 路由表
4. 页面空壳

## 9.2 第二阶段：核心双端闭环

先打通这 3 条线：

1. 家人发消息 -> 长辈首页会话带看到 -> 点进单聊
2. 长辈语音回复 -> AI 确认 -> 家人端收到
3. 消息加入回忆 -> 双端回忆页可见

## 9.3 第三阶段：状态与协作

再补：

1. 今天页
2. 状态与回访
3. 协作页
4. Alert 流程

---

## 10. 对当前 `App.tsx` 的改造建议

当前 `src/app/App.tsx` 仍是用本地 `useState` 做视图切换。

建议的重构顺序：

1. 保留现有页面内容与示意数据。
2. 先引入 `React Router`。
3. 把 `renderElderView` / `renderFamilyView` 改成真实路由页面。
4. 再逐步把旧 feature 页面抽到新页面壳里。

可参考的过渡方式：

```text
旧：App.tsx -> useState 切换 view/module
新：App.tsx -> RouterProvider -> ElderAppLayout / FamilyAppLayout
```

这样可以最大程度减少一次性重写的风险。

---

## 11. 建议优先产出的 React 文件

最适合先创建这些文件：

1. `src/app/router.tsx`
2. `src/app/layouts/ElderAppLayout.tsx`
3. `src/app/layouts/FamilyAppLayout.tsx`
4. `src/pages/elder/ElderHomePage.tsx`
5. `src/pages/elder/ElderConversationPage.tsx`
6. `src/pages/family/FamilyTodayPage.tsx`
7. `src/pages/family/FamilyConversationPage.tsx`
8. `src/components/elder/ConversationStrip.tsx`
9. `src/components/elder/ConversationCard.tsx`
10. `src/components/common/GlobalVoiceButton.tsx`

---

## 12. 结论

这套前端蓝图的核心不是“先把页面都做出来”，而是：

1. 先让路由和页面边界清楚。
2. 先把长辈端的 `AI 常驻 + 会话带` 做成稳定主干。
3. 先把家人端的 `今天 + 聊天 + 回忆 + 协作` 四块职责分开。
4. 再用本地 API 和 SQLite 慢慢把实体数据接进去。

最该优先保住的前端体验是：

1. 长辈端首页的会话带和大语音按钮。
2. 长辈端会话页的 AI 代发确认。
3. 家人端今天页的建议动作卡和 Pulse 流。
