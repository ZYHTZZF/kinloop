# Kinloop 五人分工表

## 分工原则

- 每个人主要负责不同目录，尽量避免多人长期修改同一个文件。
- 业务模块优先在 `src/features` 和 `src/pages` 下开发。
- `src/App.tsx` 属于总入口文件，只有负责主流程和最终集成的人尽量少量修改。
- 公共组件和全局样式的调整需要先沟通，避免影响其他模块。

## 五人分工

| 负责人 | 负责内容 | 主要目录 / 文件 | 边界说明 | 尽量不要动 |
| --- | --- | --- | --- | --- |
| A | 登录、注册、身份选择、绑定家庭、加入家庭、添加成员 | [src/App.tsx](./src/App.tsx)、[src/App.css](./src/App.css) | 只负责进入 App 之前的流程，以及进入后的家庭绑定相关逻辑 | 长辈端首页模块、子女端首页模块 |
| B | 长辈端：说一说、回音、找人帮忙 | [src/features/elder-talk](./src/features/elder-talk)、[src/features/elder-echo](./src/features/elder-echo)、[src/features/elder-help](./src/features/elder-help)、[src/pages/elder](./src/pages/elder) | 只管长辈端首页和长辈端功能页 | 登录流程、子女端模块 |
| C | 子女端：今日关怀、最近状态、继续关心 | [src/features/family-care](./src/features/family-care)、[src/features/family-status](./src/features/family-status)、[src/features/family-followup](./src/features/family-followup)、[src/pages/family](./src/pages/family) | 只管子女端首页和子女端功能页 | 登录流程、长辈端模块 |
| D | 聊天与语音能力：消息区、输入区、语音按钮、录音状态、AI 对接接口壳 | 建议新增 `src/features/chat-shared`、`src/features/voice`，可参考 [src/featureViews.tsx](./src/featureViews.tsx)、[src/appData.ts](./src/appData.ts) | 负责基础能力，供长辈端和子女端复用 | 业务页面文案和首页布局归属 |
| E | 公共组件、样式规范、模块接入主入口、最终联调 | [src/components](./src/components)、[src/app](./src/app)、[src/main.tsx](./src/main.tsx)、[src/index.css](./src/index.css)，必要时少量调整 [src/App.tsx](./src/App.tsx) | 负责“把模块接起来”，不是负责具体业务模块内容 | 别人模块内部实现细节 |

## 协作规则

- A 主要改进入流程，不碰首页模块细节。
- B 只改长辈端相关目录。
- C 只改子女端相关目录。
- D 只改聊天和语音基础能力层。
- E 负责公共层和最后集成。
- 新增公共组件时，优先由 E 统一收口。
- 合并前先同步主分支，减少冲突。

## 当前仓库的现实情况

- 当前真正运行的主流程仍然主要在 `src/App.tsx` 中。
- 这意味着 A 和 E 最容易在总入口上发生冲突。
- B、C、D 最好优先在新拆出来的 `features` 和 `pages` 目录里开发。
- 后续如果把登录后的首页正式接到模块化结构，团队并行开发会更稳。

## 建议开发顺序

1. A 先稳定登录和绑定家庭流程。
2. B、C 并行开发长辈端和子女端模块。
3. D 同步提供聊天和语音基础能力壳。
4. E 最后做统一接入、样式收口和联调。
