# 银龄关怀网页 App 双轨空间设计与实现规格（Beta）

## 1. 文档目的

本文档用于指导前端工程与代码代理（如 Codex）实现两个核心模块的本地原型：

1. 长辈端：回音
2. 子女端：最近状态

本文档聚焦网页端体验设计、页面结构、交互机制、状态逻辑、前端拆解方式与分阶段实现策略。

本文档不覆盖：
- 后端
- 服务器
- 数据库
- 登录与权限
- 部署
- 非本次范围内的其他页面

---

## 2. 项目目标与设计问题

### 2.1 产品目标

#### 长辈端「回音」
让长辈感受到：
- 我被回应
- 我被记住
- 我可以自然地继续说下去

#### 子女端「最近状态」
让子女明确：
- 为什么现在值得联系
- 现在最适合怎么联系
- 哪些内容是今天应该优先处理的

### 2.2 当前常规方案的问题

传统的网页方案容易退化为：
- Hero + 卡片列表
- Tab + 列表流
- Dashboard + 风险等级
- 大量白卡片 + 多按钮

这些方案的问题：
- 后台感太强
- 卡片把叙事切碎
- 用户先看到容器，不是内容
- 过度依赖点击展开
- 情绪价值和行动价值都不够强

### 2.3 设计原则

本次方案的核心原则：
- 内容先于容器
- 叙事先于列表
- 动作服务内容，而不是打断内容
- 网页端优先，不做移动端单列放大版
- 去重卡片化，不去结构化
- 先给价值，再给信息，再给动作

---

## 3. 总体架构：双轨空间（Main & Marginalia）

### 3.1 核心定义

本项目采用双轨空间作为主骨架。

不是普通双栏，也不是左右两列各自滚动的信息流。

双轨空间的定义：
- 左轨：主轴线（主叙事 / 主结论 / 主动作）
- 右轨：引力场（上下文 / 记忆 / 证据 / 聊天线索）

左轨负责告诉用户：
- 当下最值得关注的是什么
- 现在最应该做什么

右轨负责告诉用户：
- 这件事从哪里来
- 为什么它成立
- 它和过去有什么关系

### 3.2 网页端布局原则

- 最大内容宽度：1120px
- 水平居中
- 页面左右安全边距：24px
- 双轨比例：65% / 35%
- 页面不是“1 行 2 列”，而是“纵向 section 流 + 每个 section 内部共享双轨骨架”

### 3.3 为什么不用普通卡片页

- 卡片会强化“任务处理感”
- 卡片把家人互动切成信息孤岛
- 卡片让最近状态更像告警面板
- 卡片列表会让网页端空间优势被浪费

允许使用轻容器，但禁止厚重白卡片统治页面。

---

## 4. Page > Section > Session > Block 四层拆解

本项目统一采用以下拆解方式：

- Page：页面级
- Section：区块级
- Session：双轨联动的最小逻辑单元
- Block：原子组件级内容块

### 4.1 层级职责

#### Page
负责：
- 页面整体骨架
- 全局 loading / error
- 页面级布局与 section 排布

#### Section
负责：
- 组织相同层级的信息
- 定义首屏、次屏、低优先区域
- 定义是否 collapsible / progressive

#### Session
负责：
- 左轨主叙事与右轨引力场的一次完整配对
- 承载主要业务状态（new/viewed/replied/todo/doing/done 等）

#### Block
负责：
- 承载具体内容字段与具体样式表现
- 提供微交互和局部视觉反馈

---

## 5. 回音页规格

## 5.1 回音页定位

回音页不是消息中心，也不是通知流。

它是：
- 今天有人记得你说过的话
- 一个适合停留、阅读、感受、再自然回应的空间

## 5.2 Page Level 结构

回音页页面由以下 Section 组成：

1. S1: Greeting Section
   - 首屏出现
   - Normal Flow
   - 展示问候与情绪导语

2. S2: Current Echo Section
   - 首屏出现
   - Normal Flow
   - 展示最新一个完整 Echo Session 的展开态

3. S3: History Flow Section
   - 非首屏
   - Normal Flow
   - 展示历史 Echo Session 的纵向流

4. S4: Memory End Section
   - 非首屏
   - Normal Flow
   - 极简收尾，用于形成“今日回音读完”的结束感

### 5.2.1 关键说明

- S2 + S3 共享同一种 Session 骨架
- S2 是“最新 Session 的首屏放大态”
- S3 是“历史 Session 的连续流”

## 5.3 Section Level 说明

### S1 Greeting Section
作用：建立被关注的心理预期。

内容：
- 称呼
- 时间问候
- 一句导语

首屏必须出现。

### S2 Current Echo Section
作用：提供首屏最重要的一次家人回应。

内容：
- 最新 Echo Session
- 当前 session 的 Input Block
- 当前 session 的 Context Block

首屏必须出现。

### S3 History Flow Section
作用：向下滚动后提供“时间厚度”，展示过往互动的连续性。

内容：
- 多个历史 Echo Session
- 每个 Session 的右轨可带 1 个 Memory Snippet

### S4 Memory End Section
作用：弱化收尾，避免页面像无穷尽列表。

内容：
- 轻反馈或一句安静收束的文案

## 5.4 Session Level：Echo Session

一个完整 Echo Session 由以下结构组成：

- `.echo-session`
  - `.main-track`
    - `GreetingMeta`（可选）
    - `EchoBody`
    - `InputBlock`（仅最新 session 常驻）
  - `.rail-track`
    - `ContextBlock`
    - `MemorySnippet`（可选，最多 1 个）

### 5.4.1 配对规则

- 1 个左轨主叙事块，对应右轨 1~2 个辅助块
- 右轨顶部需与左轨正文顶部基线对齐
- 最新 session 首屏右轨只显示 ContextBlock，MemorySnippet 可延后或弱化

## 5.5 Block Level 规格

### Greeting
- 作用：建立情绪连接
- 内容字段：称呼、时间问候、导语文本
- 字段顺序：问候 > 导语
- 最大行数：2
- 首屏必须：是
- 视觉重量：低
- 交互性：无
- 内容来源：系统生成文案 / 本地时间上下文
- 响应式退化：窄屏保留在主轨顶部，不拆分

### Echo Body
- 作用：展示家人回应内容
- 内容字段：家人姓名、回应正文、可选语音转写、可选语音入口
- 字段顺序：姓名 > 正文 > 语音补充
- 最大行数：首屏建议 6 行内完整显示，超出继续流式展开
- 首屏必须：是
- 视觉重量：极高
- 交互性：无
- 内容来源：家人回应内容 / 语音转写
- 响应式退化：右轨信息下沉到其后，主轨保持完整

### Input
- 作用：承接长辈自然回应
- 内容字段：提示词、麦克风图标、文本输入区
- 字段顺序：Icon > 提示 > 输入
- 最大行数：提示 2 行 + 输入区
- 首屏必须：是（仅当前 session）
- 视觉重量：中
- 交互性：强
- 内容来源：用户输入入口
- 响应式退化：仍在当前 session 正下方，不做底部固定条

### Context
- 作用：右轨展示触发这次回应的长辈原话
- 内容字段：引导词、原话摘要、时间戳
- 字段顺序：引导 > 原话 > 时间
- 最大行数：3
- 允许裁切：是
- 首屏必须：是
- 视觉重量：中
- 交互性：无
- 内容来源：长辈原话 / 过去触发语句
- 响应式退化：下沉为主轨下方轻引用块

### Memory Snippet
- 作用：展示相关历史回忆碎片
- 内容字段：标签、短句、可选旧照
- 字段顺序：标签 > 短句 > 旧照
- 最大行数：3
- 允许裁切：是
- 首屏必须：否
- 视觉重量：低
- 交互性：弱
- 内容来源：历史记录 / 过去话题线索
- 响应式退化：作为当前 session 后的附段呈现

## 5.6 状态归属与规则

### Page Level
- `loading`
- `error`

### Session Level
- `new`
- `viewed`
- `replied`
- `can_continue`
- `snoozed`

### Block Level
- `is_playing`
- `hover_focus`（仅右轨增强，不承载核心信息）

### 5.6.1 状态说明

#### new
- 归属：Session
- 表现：左侧高光边带、正文最高对比度
- 触发：新回应进入数据集
- 退出：进入 viewed

#### viewed
- 归属：Session
- 表现：高光退去，正文降一档
- 触发：session 进入视口 threshold 0.75 且停留 >= 3000ms
- 退出：永久状态

#### replied
- 归属：Session
- 表现：Input Block 被本回合完成态替代
- 触发：用户完成回复确认
- 退出：永久状态

#### can_continue
- 归属：Session
- 表现：输入区 / 麦克风弱脉冲
- 触发：当前回合具备继续延展价值
- 退出：用户开始交互，或 session 失去焦点

#### snoozed
- 归属：Session
- 表现：透明度 80%，对比度略降
- 触发：被标记稍后看或长时间未处理
- 退出：session 回到焦点区

## 5.7 关键交互阈值

| 机制 | 条件 | 数值 / 阈值 | 时长 | 影响范围 |
|---|---|---:|---:|---|
| viewed 触发 | session 停留并稳定进入阅读区 | threshold 0.75, 停留 >= 3000ms | 1500ms | Echo Session 高光与正文颜色 |
| sticky top | 右轨进入粘性位置 | top 96px | 常驻 | 右轨 context / memory |
| right rail switch | 下一个 session 跨过中线 | threshold 0.5 | 300ms | 右轨内容替换 |
| mic pulse | 当前 session 可继续聊且在焦点区 | 中心处于视口 40%-70% | 3s 循环 | Input / Mic |
| snoozed restore | 被弱化 session 回到焦点区 | 焦点区重入 | 300ms | 透明度恢复 |

## 5.8 回音页实现优先级

### Batch 1
- 双轨 Grid 骨架
- Greeting + Current Echo + History Flow
- Echo Session 骨架
- Context 右轨 sticky

### Batch 2
- new -> viewed
- replied 完成态替换
- Input 多模态切换
- can_continue 弱脉冲

### Batch 3
- right rail smooth switch
- 长滚动背景色温微变
- 更精细的语音转写表现

---

## 6. 最近状态页规格

## 6.1 最近状态页定位

最近状态页不是告警面板，不是日志中心。

它是：
- 今天为什么值得联系一次
- 一个帮助子女快速完成“是否联系 + 如何联系”决策的前台空间

## 6.2 Page Level 结构

最近状态页使用双轨网格骨架，并在其上堆叠多个 Section。

### Page Grid
- 外层容器：`max-width: 1120px`
- 骨架：`grid-template-columns: minmax(0, 65%) minmax(280px, 35%)`
- 整体是：**纵向 Section 流 + 每个 Section 内部共享双轨骨架**

### Page Sections
1. S1: Priority Section
   - 首屏
   - Collapsible
   - 承载 1 个最高优 Decision Session

2. S2: Attention Section
   - 非首屏
   - Normal Flow
   - 承载 1–3 个次优 Decision Session

3. S3: Reminder Section
   - 非首屏
   - Progressive
   - 承载多个低优先 Reminder Session

## 6.3 Section Level 说明

### S1 Priority Section
作用：承载首屏主结论与最高优行动建议。

特性：
- 首屏必须完整出现
- 当前 session 完成后可收缩

### S2 Attention Section
作用：承载今天值得继续关注但不是最高优的内容。

特性：
- 纵向排列多个 Decision Session
- 保留双轨配对，但视觉权重下降

### S3 Reminder Section
作用：收纳低优先长期提醒。

特性：
- 保留左轨主内容
- 右轨不启用完整证据池，或仅保留极轻辅助

## 6.4 Session Level：Decision Session

一个完整 Decision Session 由：

- `.decision-session`
  - `.main-track`
    - `InsightBlock`
    - `ActionBlock`
    - `SecondaryPromptBlock`（可选）
  - `.rail-track`
    - `EvidenceCluster`

### 6.4.1 配对规则

- 一个 left track session 对应一个 right track evidence cluster
- `priority` 可配 2–3 个证据块
- `attention` 只配 1–2 个核心证据块
- `reminder` 默认不启用完整 evidence cluster

## 6.5 Block Level 规格

### Insight
- 作用：给出今日核心结论
- 内容字段：情绪标签、核心结论文本
- 字段顺序：标签 > 结论
- 最大行数：2
- 首屏必须：是
- 视觉重量：极高
- 交互性：无
- 内容来源：系统推断 / 结构化归纳
- 响应式退化：窄屏保留为主标题区

### Action
- 作用：触发建议动作
- 内容字段：动作类型、联系人头像、按钮文案、完成态提示
- 字段顺序：头像 > 文案 > 状态
- 最大行数：1
- 首屏必须：是
- 视觉重量：高
- 交互性：强
- 内容来源：系统建议动作 / 本地动作映射
- 响应式退化：窄屏仍保留为主按钮

### Evidence Photo
- 作用：展示现场照片或生活片段
- 内容字段：图片 URL、简短描述
- 字段顺序：图片 > 描述
- 最大行数：1
- 允许裁切：是，强制 1:1
- 首屏必须：否
- 视觉重量：中
- 交互性：弱
- 内容来源：照片 / 图像证据
- 响应式退化：窄屏下沉到主轨后，仅保留 1 张

### Evidence Quote
- 作用：展示可作为聊天线索的原话
- 内容字段：来源、引用文本
- 字段顺序：来源 > 引文
- 最大行数：3
- 允许裁切：是
- 首屏必须：否
- 视觉重量：中
- 交互性：无
- 内容来源：老人原话 / 日记 / 对话摘录
- 响应式退化：变成主轨中的引用段

### Evidence Data
- 作用：展示轻量化数据佐证
- 内容字段：数据项名、数值、单位、趋势
- 字段顺序：数值+单位 > 项名 > 趋势
- 最大行数：1
- 首屏必须：否
- 视觉重量：中
- 交互性：无
- 内容来源：设备数据 / 统计数据
- 响应式退化：默认后置到当前 session 末尾，非关键项可隐藏

### Reminder
- 作用：展示长期备忘
- 内容字段：备忘标题、内容摘要
- 字段顺序：标题 > 内容
- 最大行数：2
- 允许裁切：是
- 首屏必须：否
- 视觉重量：极低
- 交互性：无
- 内容来源：低优先长期提醒 / 系统备忘
- 响应式退化：窄屏为单轨低对比度段落群

### Evidence Cluster
- 作用：承载一组证据块
- 内容字段：Photo / Quote / Data 数组
- 字段顺序：Photo > Quote > Data
- 一屏最多：3 块
- 允许裁切：是
- 首屏必须：否
- 视觉重量：中
- 交互性：弱
- 内容来源：多源证据聚合
- 响应式退化：不保留拼贴集群，改为主轨后置顺序块

## 6.6 状态归属与规则

### Page Level
- `loading`
- `error`

### Section Level
- `is_collapsed`（Priority Section 是否折叠）

### Session Level
- `priority`
- `attention`
- `reminder`
- `todo`
- `doing`
- `done`

### 6.6.1 状态说明

#### priority
- 归属：Session
- 表现：进入 S1，字号最大，主动作最强，右轨证据全开
- 触发：策略判定为最高优
- 退出：done 或降级

#### attention
- 归属：Session
- 表现：进入 S2，中等字号，中等证据量
- 触发：策略判定为次优
- 退出：done / 降级 / 移出

#### reminder
- 归属：Session
- 表现：进入 S3，低灰度，无完整右轨
- 触发：策略判定为低优先长期备忘
- 退出：次日重算或升降级

#### todo
- 归属：Session
- 表现：Action 为主色高亮
- 触发：初始待处理
- 退出：doing / done

#### doing
- 归属：Session
- 表现：Action 进入进行态，当前 Decision Session 处于处理中
- 触发：用户触发主动作并进入本地处理中确认
- 退出：本地完成确认后进入 done

#### done
- 归属：Session
- 表现：当前 session 完成感增强，主权重下降；若其属于 S1，则可触发 Section 收缩
- 触发：主动作完成确认
- 退出：次日重算或历史归档

#### is_collapsed
- 归属：Section
- 表现：S1 收缩为完成摘要栏
- 触发：S1 内当前最高优 session 完成
- 退出：页面重置 / 次日刷新

## 6.7 关键交互阈值

| 机制 | 条件 | 数值 / 阈值 | 时长 | 影响范围 |
|---|---|---:|---:|---|
| sticky top | 右轨 evidence 到达粘性位置 | top 96px | 常驻 | Evidence Cluster |
| right rail switch | 下一个 session 跨过中线 | threshold 0.5 | 300ms | 右轨证据替换 |
| collapsible 触发 | S1 内当前主 session = done | `done === true` | 500ms | Priority Section |
| hero shrink | 主动作完成确认后 | 本地完成确认 | 600ms | 首屏区块收缩与下方上移 |
| hover enhance | 鼠标进入证据块或主按钮 | mouseenter | 180–220ms | 右轨证据块、主动作 |
| scroll-spy | 当前活跃 session 变化 | active session index 改变 | 400ms | 左轨重心同步、右轨切换 |
| done settle | done 收束 | 完成确认后 | 500–700ms | 已完成文案与视觉降重 |

## 6.8 右轨控制铁律

1. 一屏最多 3 块
2. 优先级：Photo > Quote > Data
3. 禁复杂图表
4. 禁系统通知与日志文本
5. 禁厚重卡片底板
6. 图片统一 1:1 裁切
7. 非关键数据默认不入右轨

## 6.9 最近状态页实现优先级

### Batch 1
- 双轨骨架
- Priority / Attention / Reminder 三段结构
- Decision Session 容器
- Action / Insight / Evidence 基本块

### Batch 2
- Session 状态驱动
- Priority 完成后 Section 收缩
- 右轨 sticky + 基本切换
- 证据块裁切与限制

### Batch 3
- 更平滑的 right rail switch
- 更丰富的 hover 增强
- 更细致的完成态收束动画

---

## 7. 响应式退化原则

本项目网页端优先，窄屏只做退化，不重做结构逻辑。

### 7.1 总体原则
- 不退回普通卡片列表页
- 保留主轴 / 引力场关系，但将右轨信息下沉为主轨附段
- 保留首屏价值表达，不允许直接退化为信息列表

### 7.2 回音页窄屏退化
- Greeting 保留
- Current Echo Session 保留为单轨
- Context 变成 Echo Body 下的轻引用块
- Memory Snippet 变成主轨后续次级段落
- Input 仍贴在当前 session 正下方

### 7.3 最近状态页窄屏退化
- Priority Session 仍首屏优先
- Evidence Cluster 不再侧挂，改为主轨后置顺序块
- Attention / Reminder 继续向下流动
- 不做完整拼贴墙，只保留 1 图 + 1 引语 + 可选关键数据

---

## 8. 开发约束与边界

本轮只做本地原型，不接后端。

### 8.1 允许改动目录
- `src/features/elder-echo/**`
- `src/features/family-status/**`

### 8.2 禁止改动目录
- `src/app/**`
- `src/pages/**`
- `src/components/common/**`

### 8.3 禁止事项
- 不接真实后端
- 不退回普通 Hero + 卡片 + 列表方案
- 不用厚重白卡片统治页面
- 不把页面做成移动端单列放大版

---

## 9. 验收标准

## 9.1 回音页
- 第一眼不再像消息列表
- 最新回音首屏直给
- 回复入口自然贴在内容正下方
- 右轨是上下文 / 记忆，不是另一列列表
- `new -> viewed -> replied` 可复现
- `can_continue / snoozed` 有明确界面表现

## 9.2 最近状态页
- 第一眼不再像告警中心
- 首屏先给今日建议，再给证据
- Evidence 是当前 session 的右轨配对内容
- `priority / attention / reminder` 分层清晰
- `todo / doing / done` 可复现
- done 后首屏可收缩

## 9.3 工程
- 只改 B 模块目录
- build 通过
- B 模块作用域 lint 通过
- 无真实后端依赖

---

## 10. 给 Codex 的使用说明

如果把本文档交给 Codex，请要求它：

1. 先阅读并复述文档结构
2. 按 Batch 1 -> Batch 2 -> Batch 3 分阶段实现
3. 每阶段后执行：
   - `npm.cmd run test`
   - `npm.cmd run lint`
   - `npm.cmd run build`
   - `npm.cmd run typecheck`
   - `npm.cmd exec eslint src/features/elder-echo src/features/family-status`
4. 若命令不存在要记录
5. 若命令失败要先修复再继续
6. 不允许越目录改动
7. 不允许把方案偷换回普通卡片页

---

## 11. 下一步建议

基于本文档，下一步最适合产出：

1. 桌面端线框图说明
2. 组件树与页面装配图
3. 给 Codex 的分阶段执行 prompt

