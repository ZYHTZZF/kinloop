# Kinloop Cleanup Plan V1

## 1. 文档目的

这份清理清单用于在新 PRD 骨架已经落地后，明确哪些旧文件：

1. 可以直接删除
2. 应保留并迁移
3. 先作为 legacy 资产保留，等待下一轮接入

当前判断基于：

1. 新首页与新路由已经落地
2. 项目已通过构建
3. 当前目标是优先推进首页和主流程，而不是一次性推翻全部旧模块

---

## 2. 已删除文件

以下文件已确认脱离当前主流程，且没有被新骨架引用：

1. `src/app/types.ts`
   原因：原来只服务于 `App.tsx` 的 `useState` 切页方案，路由上线后已失效。

2. `src/components/layout/WorkspaceShell.tsx`
   原因：原来承载“切换长辈端/子女端”的工作台壳子，新版已经由 `ElderAppLayout` / `FamilyAppLayout` 替代。

3. `src/featureViews.tsx`
   原因：属于旧的 feature shell 和模块化演示逻辑，当前不再挂载到主流程。

4. `src/pages/family/FamilyHomePage.tsx`
   原因：已被新版 `FamilyTodayPage.tsx` 替代。

5. `src/features/elder-talk/components/TalkEntryPage.tsx`
6. `src/features/elder-talk/components/TalkModule.tsx`
7. `src/features/elder-echo/components/EchoEntryPage.tsx`
8. `src/features/elder-echo/components/EchoModule.tsx`
9. `src/features/elder-help/components/HelpEntryPage.tsx`
10. `src/features/elder-help/components/HelpModule.tsx`
11. `src/features/family-care/components/CareTodayEntryPage.tsx`
12. `src/features/family-care/components/CareTodayModule.tsx`
13. `src/features/family-followup/components/ContinueCareEntryPage.tsx`
14. `src/features/family-followup/components/ContinueCareModule.tsx`
15. `src/features/family-status/components/RecentStatusEntryPage.tsx`
16. `src/features/family-status/components/RecentStatusModule.tsx`
   原因：这批文件都属于旧首页入口或旧入口承载页，新路由和新页面壳已经完全替代它们。

---

## 3. 保留并迁移的文件

这类文件当前不直接挂在主路由上，但内容有复用价值，建议后续抽组件迁移，不立刻删除。

### 3.1 长辈端旧 feature

1. `src/features/elder-talk/**`
   状态：
   - 已完成内容迁移
   - 文案与轻量提示已迁入 `src/domain/content`

2. `src/features/elder-echo/**`
   状态：
   - 已完成内容迁移
   - 残余旧组件已删除
   - 文案内容已迁入 `src/domain/content`

3. `src/features/elder-help/**`
   状态：
   - 已完成内容迁移
   - 求助说明文案已迁入 `src/domain/content`

### 3.2 家人端旧 feature

1. `src/features/family-care/**`
   状态：
   - 已完成内容迁移
   - 轻量建议文案已迁入 `src/domain/content`

2. `src/features/family-status/**`
   状态：
   - 已完成内容迁移
   - 辅助说明文案已迁入 `src/domain/content`

3. `src/features/family-followup/**`
   状态：
   - 已完成内容迁移
   - 回访辅助文案已迁入 `src/domain/content`

---

## 4. 暂时保留为 legacy 的文件

这类文件暂时不删，原因是它们可能还承载旧的示意数据或以后能当参考。

1. `src/appData.ts`
   当前作用：
   - 营销页与旧模块文本来源之一
   保留原因：
   - 仍有部分文案和枚举值有参考价值
   后续动作：
   - 等新 mock 数据与真实 SQLite 数据成型后，再逐步拆解或删除

2. `src/features/**`
   当前状态：
   - 仅剩极少数未迁移的目录壳
   - 已不再承载主流程代码
   后续动作：
   - 可在 UI 精修阶段后继续收目录

---

## 5. 下一轮建议删除候选

以下内容在下一轮优先评估：

1. `src/appData.ts` 中已经不再服务现有路由结构的旧枚举与旧导航文案
2. 完全空置的 `src/features/*` 目录壳

原因：

1. 这批文件仍然可能含有局部可复用结构
2. 但它们已经不再属于当前主流程
3. 等真实本地 API 接入后，能够更准确判断哪些彻底不需要

---

## 6. 当前清理策略

本轮遵循：

1. 先删掉“完全失效且无引用”的骨架文件
2. 保留“内容还可迁移”的 feature 模块
3. 先不动营销页
4. 等首页和主流程继续稳定后，再做第二轮清理

---

## 7. 下一轮清理建议

当以下条件满足后，可以做第二轮清理：

1. 长辈端首页和会话页开始接真实本地 API
2. 家人端今天页和状态页开始接真实本地 API
3. 已经明确哪些旧 feature 组件被抽到了新页面中

第二轮可做的动作：

1. 删除旧首页入口模块
2. 收缩旧 feature 目录
3. 拆分通用组件到 `components/elder`、`components/family`、`components/common`
4. 把 `mockData.ts` 拆为更细的 domain mock 文件
