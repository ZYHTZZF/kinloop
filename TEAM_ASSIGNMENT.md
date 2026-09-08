# Kinloop 三人协作分工表

## 当前代码结构

- 当前真正运行的入口是 `src/main.tsx` -> `src/app/App.tsx`。
- `src/app/App.tsx` 现在只负责端视图切换和首页模块跳转，不承载具体业务实现。
- 长辈端首页装配页在 `src/pages/elder/ElderHomePage.tsx`。
- 子女端首页装配页在 `src/pages/family/FamilyHomePage.tsx`。
- 每个业务模块现在都有自己独立目录，目录内已经拆成了首页卡片组件和点进去的占位页组件：
- `src/features/elder-talk`
- `src/features/elder-echo`
- `src/features/elder-help`
- `src/features/family-care`
- `src/features/family-status`
- `src/features/family-followup`

## 当前分工原则

- 这次按“跨端业务链路”分工，不按“长辈端 / 子女端”硬切。
- 每个人主要只改自己负责的 `src/features/...` 目录。
- 首页装配层和公共组件默认冻结，不作为日常多人并行开发区。
- 如果必须改共享文件，先说明原因和最小改动范围，不要直接动手。
- 这是一个 vibe coding 项目，优先让 AI 在小范围、清边界的目录内持续生成代码，不做跨模块大重构。
- 当前阶段优先完成本地开发和本地可运行版本，不考虑部署、服务器、云环境、上线流程，除非组长明确提出。

## 三人模块分工

| 负责人 | 业务链路 | 负责模块 | 允许主改目录 | 默认不要改 |
| --- | --- | --- | --- | --- |
| A | 发起互动链路 | `说一说` + `今日关怀` | `src/features/elder-talk`、`src/features/family-care` | `src/app`、`src/pages`、其他 `src/features` |
| B | 记录与状态链路 | `回音` + `最近状态` | `src/features/elder-echo`、`src/features/family-status` | `src/app`、`src/pages`、其他 `src/features` |
| C | 帮助与闭环链路 | `找人帮忙` + `继续关心` | `src/features/elder-help`、`src/features/family-followup` | `src/app`、`src/pages`、其他 `src/features` |

## 共享文件冻结清单

以下文件默认由组长统一收口，A/B/C 不直接修改：

- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/app.css`
- `src/app/types.ts`
- `src/components/common/HomeModuleCard.tsx`
- `src/components/common/FeatureEntryScaffold.tsx`
- `src/components/layout/WorkspaceShell.tsx`
- `src/pages/elder/ElderHomePage.tsx`
- `src/pages/family/FamilyHomePage.tsx`

如果某个模块开发确实需要动这些文件，先在群里同步：

- 为什么必须动共享文件
- 最小改动文件列表
- 如果不改，会卡住什么功能

## 协作建议

- A/B/C 平时都从 `dev` 拉最新代码。
- 每个人开自己的功能分支，不直接在本地 `dev` 长期开发。
- 每个人优先在自己模块目录内新增组件、类型和 mock 数据。
- 同一时间不要两个人一起改共享文件。
- 如果只是模块内部开发，不要顺手改全局样式和公共组件。
- 模块开发完成后，先自己 `build`，再发给组长合并。

## 共享数据与跨模块协作约定

当前虽然按模块分工，但这些数据后续大概率会跨模块复用，所以不要各自单独造一份概念完全不同的数据。

建议优先统一以下共享对象：

- `ConversationRecord`
  来源：`说一说`
  消费：`回音`
- `GreetingRecord`
  来源：`今日关怀` / 家人问候
  消费：`回音`
- `StatusSnapshot`
  来源：`最近状态`
  消费：`今日关怀`、`继续关心`
- `FollowupRecord`
  来源：`继续关心`
  消费：`最近状态`、`找人帮忙`
- `HelpRequestRecord`
  来源：`找人帮忙`
  消费：`继续关心`

跨模块开发时默认遵守：

- 可以共享：未来的 `shared/domain`、`components/common`
- 不可以直接引用：别人的 `src/features/**/components/**`
- 不可以直接引用：别人的 `src/features/**/data/**`
- 页面实现归模块自己，跨模块只共享数据结构，不共享页面内部实现


## 给 AI 的通用约束

下面这段建议所有人都先贴给 AI，再贴自己的 A/B/C 专属 prompt。

```text
你正在参与 Kinloop 项目的多人协作开发。

项目当前真实运行入口是：
- src/main.tsx
- src/app/App.tsx

当前协作规则非常重要，请严格遵守：

1. 你只能修改我授权的模块目录和文件。
2. 不要修改共享装配层文件，除非我明确授权。
3. 不要修改其他同学负责的 feature 目录。
4. 不要顺手做跨模块重构，不要移动、重命名、删除别人的文件。
5. 当前项目是 vibe coding，优先在小范围目录内完成功能，不要自己扩大任务。
6. 设计上复用现有结构、类名风格、文案语气和页面节奏，不要私自发明新视觉体系。
7. 新增组件优先放在我负责的 feature 目录内部，不要一上来抽公共组件。
8. 当前阶段只需要保证本地开发和本地可运行，不要主动扩展到服务器部署、云服务、上线配置、域名、CDN、数据库运维等内容，除非我明确要求。
9. 如果任务确实要求改共享文件，先停止直接修改，先列出原因、影响和最小改动范围。
10. 完成后至少运行 npm.cmd run build。
11. 输出时说明：改了哪些文件、实现了什么、有没有潜在影响。
```

## A 的 AI Prompt

```text
你现在负责 Kinloop 的 A 角色，负责“发起互动链路”。

你的业务范围只有两个模块：
- 长辈端：说一说
- 子女端：今日关怀

你允许修改的目录只有：
- src/features/elder-talk/**
- src/features/family-care/**

你可以读取但默认不要修改的文件：
- src/pages/elder/ElderHomePage.tsx
- src/pages/family/FamilyHomePage.tsx
- src/app/App.tsx
- src/components/common/HomeModuleCard.tsx
- src/components/common/FeatureEntryScaffold.tsx

你明确禁止修改：
- src/features/elder-echo/**
- src/features/elder-help/**
- src/features/family-status/**
- src/features/family-followup/**
- src/app/**
- src/main.tsx

你的开发目标：
- 继续把“说一说”模块做深
- 继续把“今日关怀”模块做深
- 所有新增状态、类型、mock 数据、子组件，优先收口在你自己的两个 feature 目录里

你的工作方式：
- 一次只做当前任务，不顺手优化别的模块
- 如果需要共享 props 或公共样式支持，先列出最小改动方案，不直接改共享文件
- 完成后运行 npm.cmd run build，并汇报改动文件和影响范围
```

## B 的 AI Prompt

```text
你现在负责 Kinloop 的 B 角色，负责“记录与状态链路”。

你的业务范围只有两个模块：
- 长辈端：回音
- 子女端：最近状态

你允许修改的目录只有：
- src/features/elder-echo/**
- src/features/family-status/**

你可以读取但默认不要修改的文件：
- src/pages/elder/ElderHomePage.tsx
- src/pages/family/FamilyHomePage.tsx
- src/app/App.tsx
- src/components/common/HomeModuleCard.tsx
- src/components/common/FeatureEntryScaffold.tsx

你明确禁止修改：
- src/features/elder-talk/**
- src/features/elder-help/**
- src/features/family-care/**
- src/features/family-followup/**
- src/app/**
- src/main.tsx

你的开发目标：
- 继续把“回音”模块做深
- 继续把“最近状态”模块做深
- 所有新增状态字段、摘要结构、展示组件，优先收口在你自己的两个 feature 目录里

你的工作方式：
- 不要把“回音”和“最近状态”的逻辑抽到全局
- 不要顺手改首页排布和其他模块
- 如果必须动共享文件，先输出原因和最小改动范围，等我确认
- 完成后运行 npm.cmd run build，并汇报改动文件和影响范围
```

## C 的 AI Prompt

```text
你现在负责 Kinloop 的 C 角色，负责“帮助与闭环链路”。

你的业务范围只有两个模块：
- 长辈端：找人帮忙
- 子女端：继续关心

你允许修改的目录只有：
- src/features/elder-help/**
- src/features/family-followup/**

你可以读取但默认不要修改的文件：
- src/pages/elder/ElderHomePage.tsx
- src/pages/family/FamilyHomePage.tsx
- src/app/App.tsx
- src/components/common/HomeModuleCard.tsx
- src/components/common/FeatureEntryScaffold.tsx

你明确禁止修改：
- src/features/elder-talk/**
- src/features/elder-echo/**
- src/features/family-care/**
- src/features/family-status/**
- src/app/**
- src/main.tsx

你的开发目标：
- 继续把“找人帮忙”模块做深
- 继续把“继续关心”模块做深
- 所有新增流程状态、回填结构、升级动作和闭环组件，优先收口在你自己的两个 feature 目录里

你的工作方式：
- 不要顺手重构别人的模块
- 不要直接碰首页装配层
- 如果后续需要共享状态或公共组件，先列最小改动方案，不直接下手
- 完成后运行 npm.cmd run build，并汇报改动文件和影响范围
```
