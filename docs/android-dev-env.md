# Android 开发环境说明

## API 地址配置

前端现在已经支持通过环境变量切换 API 和 WebSocket 地址：

- `VITE_API_BASE_URL`
- `VITE_WS_BASE_URL`
- `VITE_API_BASE_PATH`

默认情况下：

- Web 开发环境会继续按当前页面地址推导
- Android 原生容器会优先读取 `.env.local` 中的 `VITE_API_BASE_URL` 和 `VITE_WS_BASE_URL`

## 本地开发时怎么填

### 1. Android 模拟器连接本机后端

如果后端跑在你电脑本机，Android 模拟器里通常不要写 `127.0.0.1`，而要写：

```env
VITE_API_BASE_URL=http://10.0.2.2:8787
VITE_WS_BASE_URL=ws://10.0.2.2:8787
VITE_API_BASE_PATH=/api
```

### 2. 真机连接电脑后端

如果用真机调试，填写你电脑在局域网里的 IP，例如：

```env
VITE_API_BASE_URL=http://192.168.1.100:8787
VITE_WS_BASE_URL=ws://192.168.1.100:8787
VITE_API_BASE_PATH=/api
```

注意：

- 手机和电脑需要在同一个局域网
- 后端监听地址不能只绑 `127.0.0.1`，需要允许局域网访问
- Windows 防火墙可能需要放行 8787 端口

## 当前已完成的 Android 接入

- Capacitor 已接入
- `android/` 工程已生成
- Web 构建产物可同步到 Android assets
- API/WS 地址已从写死的 `/api` 和固定端口逻辑抽离
- Android 明文 HTTP 开发配置已开启

## 当前阻塞

本机 Java 仍是 1.8，Android Gradle Plugin 8 需要 Java 11 以上，建议直接使用 JDK 17。

安装并切换 JDK 17 后，可继续执行：

```bash
npm run build:android
```

或：

```bash
npm run android:open
```
