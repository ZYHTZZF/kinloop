# Kinloop Android App 改造方案

## 1. 当前项目现状

当前仓库本质上是一个 `Vite + React + TypeScript` 的 Web 项目，包含两部分：

- 前端：`src/`
- 本地 Node 服务：`server/`

前端里已经有比较完整的业务能力：

- 老人端 / 家属端页面与路由
- 聊天与会话详情
- 语音助手入口
- 音视频通话
- 通知、本地存储、摄像头/麦克风调用

对 Android 迁移影响最大的几个点也很明确：

- `src/services/api/client.ts` 目前默认走 `/api`，依赖 Vite 开发代理
- `server/` 是 Node/Express 服务，不能直接打进 Android APK 里运行
- `src/components/elder/ElderVoiceAssistant.tsx` 使用了 `webkitSpeechRecognition`
- `src/services/webrtc/WebRTCManager.ts` 直接依赖浏览器 `RTCPeerConnection`
- `src/utils/notification.ts` 直接依赖浏览器 `Notification` 和 `serviceWorker`

所以，这个项目可以改成 Android App，但不适合“原地硬包一个 WebView 就上线”。最可行的方案是：

## 2. 推荐技术路线

采用 `Capacitor + 现有 React Web 前端` 的混合方案，把当前前端作为 Android App 的 UI 主体保留下来，再逐步把浏览器专属能力替换为 Android 能力。

推荐理由：

- 现有页面、路由、样式、业务状态管理可以最大化复用
- Android 容器可以接入相机、麦克风、通知、存储等原生能力
- 比“全部重写成 Kotlin/Jetpack Compose”成本低很多
- 比“只做 WebView 壳”更容易处理权限、通知和后续原生扩展

不建议的路线：

- 直接重写原生 Android：周期长，现有 React 页面基本无法复用
- 只做纯 WebView 壳：能跑，但语音、通知、权限、音视频稳定性风险过高
- TWA/PWA：更适合内容型应用，不适合当前这种强交互、多权限、多媒体应用

## 3. 可行的目标架构

建议拆成三层：

### A. 前端展示层

继续保留当前 React 代码：

- 页面结构与路由继续使用现有 `src/app`、`src/pages`
- 聊天、家庭空间、老人端/家属端 UI 尽量不重写

### B. Android 容器层

新增 Android 工程并由 Capacitor 承载：

- Web 资源打包进 Android App
- 通过 Capacitor 插件申请和管理权限
- 提供相机、麦克风、通知、文件访问、App 生命周期等原生桥接

### C. 服务端能力层

把现在的 `server/` 作为独立后端运行，而不是塞进 APK：

- Android App 请求线上/局域网部署的 API 服务
- WebSocket / 实时消息继续走独立服务
- 情绪识别、语音转写、AI 意图分析继续留在服务端

## 4. 模块迁移策略

### 4.1 可直接复用

这些部分适合第一阶段原样复用：

- 页面与路由
- 大部分组件与样式
- 领域数据结构 `src/domain`
- API 类型定义与大多数业务流程
- 本地 mock 逻辑

### 4.2 需要改造成“平台适配层”

这些能力要从“浏览器直调”改成“统一接口 + Android/Web 双实现”：

- API 基地址
- 本地存储
- 语音识别
- 通知
- 权限申请
- 音视频采集
- 图片/音频上传

建议新增目录，例如：

```text
src/platform/
  apiConfig.ts
  permissions.ts
  notifications.ts
  speech.ts
  media.ts
  storage.ts
```

页面层不再直接碰 `window`、`Notification`、`webkitSpeechRecognition`，统一通过 `platform` 层调用。

### 4.3 需要重点验证的高风险能力

#### 音视频通话

当前实现基于浏览器 WebRTC。理论上 Android WebView/Capacitor 可支持，但需要重点验证：

- 摄像头/麦克风权限是否稳定
- 切前后台后音视频状态是否异常
- 回声、黑屏、切换前后摄像头是否正常
- 低端安卓机和系统 WebView 版本差异

建议策略：

- 第一阶段先保留 WebRTC 方案做真机验证
- 如果验证不稳定，再把通话模块单独替换成原生方案

原生备选：

- 直接接 Android WebRTC SDK
- 或接入更成熟的通话方案，如 LiveKit / Agora / ZEGO / 声网

#### 语音识别

`webkitSpeechRecognition` 在 Android 里不能作为可靠正式方案。

建议策略：

- Web 端保留现状
- Android 端改为 Capacitor 插件或自定义原生桥接
- 统一暴露 `startSpeechRecognition()` / `stopSpeechRecognition()` 等接口

#### 通知

浏览器 `Notification` 在 App 内体验和能力都不够。

建议策略：

- 前台提醒可继续用前端 UI toast / 弹层
- 本地通知、唤醒提醒、未读消息提醒改为 Android 本地通知/推送
- 后续若需要离线消息，接 Firebase Cloud Messaging

## 5. 分阶段实施方案

## 阶段 1：先让 App 跑起来

目标：一周内形成可安装 APK 的基础版本。

工作内容：

- 引入 Capacitor
- 生成 `android/` 工程
- 配置 App 名称、包名、图标、启动页
- 把前端构建产物接入 Android 容器
- 增加 Android 端网络访问配置
- 真机验证基础页面、路由、样式、触摸交互

阶段 1 交付结果：

- 可以安装到安卓手机
- 首页、聊天列表、详情页、老人端/家属端页面可正常浏览
- 本地 mock 模式下可演示基础流程

## 阶段 2：打通正式接口

目标：让 Android App 脱离 Vite 开发代理，直连真实后端。

工作内容：

- 把 `/api` 改造成可配置的 API Base URL
- 区分开发环境、测试环境、生产环境
- 处理 Android 真机访问局域网/测试环境地址
- 补齐 WebSocket 地址配置
- 检查跨域、HTTPS、证书和网络安全策略

阶段 2 交付结果：

- App 能直接请求后端 API
- 不再依赖本地 `vite proxy`

## 阶段 3：原生能力桥接

目标：把浏览器专属能力替换为 Android 可靠能力。

工作内容：

- 相机/麦克风权限封装
- 本地通知封装
- 语音识别桥接
- 文件/相册访问桥接
- 前后台生命周期处理

阶段 3 交付结果：

- 语音入口在安卓机可稳定使用
- 通知能力符合 App 使用习惯
- 权限申请过程可控

## 阶段 4：专项攻坚音视频通话

目标：验证并稳定通话体验。

工作内容：

- 在真机上验证当前 WebRTC 方案
- 处理麦克风占用、音频路由、前后台切换
- 处理通话中断恢复和异常退出
- 视验证结果决定是否切原生 RTC

阶段 4 交付结果：

- 输出“继续沿用 WebRTC Web 方案”或“切换原生 RTC”的结论
- 有一套可复现的测试清单和回归标准

## 6. 建议的代码改造顺序

建议按下面顺序推进，这样返工最少：

1. 先接 Capacitor，生成 Android 容器
2. 把 API 地址从写死的 `/api` 抽离出来
3. 新建 `platform` 适配层，收口浏览器 API
4. 替换语音识别和通知
5. 最后专项验证音视频通话

这个顺序的关键原因是：

- API 和平台适配层如果不先做，后面每个页面都会反复改
- 通话是最高风险模块，应该放在容器跑通之后集中验证

## 7. 对当前仓库的具体改动建议

### 必做

- 增加 Android 容器工程
- 增加 Capacitor 配置文件
- 新增 API 环境配置
- 新增平台适配层
- 把直接访问浏览器能力的代码逐步收口

### 优先改造的现有文件

- `src/services/api/client.ts`
- `src/components/elder/ElderVoiceAssistant.tsx`
- `src/services/webrtc/WebRTCManager.ts`
- `src/utils/notification.ts`
- 所有直接访问 `window.localStorage`、`navigator.mediaDevices` 的模块

## 8. 风险与结论

### 低风险

- 页面 UI 复用
- 路由复用
- 聊天、家庭空间、记忆、状态等大多数业务逻辑复用

### 中风险

- Android 真机下的网络环境配置
- 本地存储与文件权限
- 通知行为与前后台状态一致性

### 高风险

- 浏览器语音识别能力在 Android App 中的可用性
- WebRTC 音视频通话稳定性

## 结论

这个项目完全可以改成 Android App，并且最可行、性价比最高的路径是：

`现有 React 前端 + Capacitor Android 容器 + 独立部署的后端服务`

如果要控制成本并尽快出可运行版本，建议先做到：

1. App 壳跑起来
2. 正式 API 打通
3. 语音/通知桥接
4. 最后攻坚音视频通话

如果你愿意，我下一步可以直接在这个 `android_dev` 分支继续做第一阶段落地，把 Capacitor 和 `android/` 工程先搭起来，并顺手把 `/api` 配置改成 Android 可用的环境变量方案。
