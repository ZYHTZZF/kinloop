# Railway 部署指南

## 适用范围

本指南用于将 Kinloop 的后端 `server/` 部署到 Railway，供 Android App 和其他客户端访问。

## 部署方式

推荐使用仓库根目录的 `Dockerfile` 部署。

这样做的好处：

- 依赖更稳定
- 不依赖 Railway 自动猜测启动命令
- 后端运行目录和本地一致

## 需要的 Railway 配置

### 1. 创建一个 Web Service

- 连接 GitHub 仓库
- 选择当前项目仓库
- Railway 会自动识别 `Dockerfile`

### 2. 添加 Volume

必须添加一个 Volume，用来持久化：

- SQLite 数据库
- 上传文件

建议把 Volume 挂载到：

```text
/data
```

因为容器默认会使用：

- 数据库：`/data/kinloop.db`
- 上传目录：`/data/uploads`

### 3. 设置环境变量

至少配置这些：

```env
KINLOOP_API_HOST=0.0.0.0
KINLOOP_DATA_DIR=/data
```

如果你想显式指定数据库和上传目录，也可以加：

```env
KINLOOP_DB_PATH=/data/kinloop.db
KINLOOP_UPLOADS_DIR=/data/uploads
```

另外还需要补齐你的 AI / ASR 相关密钥，例如：

```env
KINLOOP_LLM_API_KEY=...
KINLOOP_LLM_BASE_URL=...
KINLOOP_LLM_MODEL=...
KINLOOP_ASR_MODEL=...
KINLOOP_ASR_API_KEY=...
KINLOOP_ASR_BASE_URL=...
KINLOOP_VOLCANO_API_KEY=...
KINLOOP_VOLC_ASR_APP_ID=...
KINLOOP_VOLC_ASR_ACCESS_TOKEN=...
KINLOOP_VOLC_ASR_RESOURCE_ID=...
HUME_API_KEY=...
HUME_SECRET_KEY=...
```

说明：

- Railway 会自动注入 `PORT`
- 当前后端已经兼容 `PORT`

## 部署后检查

部署成功后，先访问：

```text
https://你的-railway-域名/api/health
```

正常应返回：

- `ok: true`
- 当前服务名
- 数据库路径

## Android App 配置

后端上线后，把 Android 端环境变量改成：

```env
VITE_API_BASE_URL=https://你的-railway-域名
VITE_WS_BASE_URL=wss://你的-railway-域名
VITE_API_BASE_PATH=/api
```

然后重新执行：

```bash
npm run build
npm run cap:sync
```

再重新打 APK。

## 注意事项

- Railway 默认磁盘不是持久化的，所以 Volume 不能省
- 当前项目使用 SQLite，比赛演示可以接受
- 如果后续多人并发明显增加，建议改成 Postgres
