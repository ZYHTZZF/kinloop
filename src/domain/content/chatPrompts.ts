/**
 * 聊天相关的文案和常量
 */

// 预设消息 - 子女端
export const PRESET_MESSAGES_FAMILY = [
  '好的',
  '明白了',
  '稍等',
  '谢谢',
  '晚安',
  '早上好',
  '午安',
  '再见'
]

// 预设消息 - 老人端（简化）
export const PRESET_MESSAGES_ELDER = ['好的', '谢谢', '再见', '我来了']

// 通话状态文案
export const CALL_STATES = {
  idle: '空闲',
  ringing: '呼叫中...',
  connecting: '连接中...',
  connected: '通话中',
  ended: '已挂断'
}

// 消息状态文案
export const MESSAGE_STATUSES = {
  sending: '发送中',
  sent: '已发送',
  delivered: '已传达',
  read: '已读'
}

// 消息类型文案
export const MESSAGE_TYPES = {
  text: '文字',
  image: '图片',
  voice: '语音'
}

// 错误消息
export const ERROR_MESSAGES = {
  NO_CAMERA_PERMISSION: '摄像头权限被拒绝，请在设置中允许',
  NO_MICROPHONE_PERMISSION: '麦克风权限被拒绝，请在设置中允许',
  WEBRTC_NOT_SUPPORTED: '浏览器不支持 WebRTC，请升级浏览器',
  CONNECTION_FAILED: '连接失败，请检查网络',
  CALL_ENDED_ABNORMALLY: '通话异常断开',
  MESSAGE_SEND_FAILED: '消息发送失败，请重试',
  WEBSOCKET_DISCONNECTED: 'WebSocket 连接已断开',
  UNKNOWN_ERROR: '发生未知错误'
}

// 成功消息
export const SUCCESS_MESSAGES = {
  CALL_CONNECTED: '通话已连接',
  MESSAGE_SENT: '消息已发送',
  CALL_REJECTED: '拒接成功',
  NOTIFICATION_PERMISSION_GRANTED: '通知权限已开启'
}

// 警告消息
export const WARNING_MESSAGES = {
  WEAK_NETWORK: '网络质量较差，自动降低视频质量',
  STORAGE_FULL: '本地存储接近满，请清理旧消息',
  CALL_NO_AUDIO: '未检测到音频，请检查麦克风'
}

// 网络质量标签
export const NETWORK_QUALITY_LABELS = {
  high: '网络优秀',
  medium: '网络一般',
  low: '网络差'
}

// 通话超时设置（毫秒）
export const CALL_TIMEOUT = 60000 // 60 秒

// ICE 连接超时（毫秒）
export const ICE_TIMEOUT = 10000 // 10 秒

// 心跳间隔（毫秒）
export const HEARTBEAT_INTERVAL = 30000 // 30 秒

// 自动重连最大尝试次数
export const MAX_RECONNECT_ATTEMPTS = 5

// 自动重连延迟（毫秒）
export const RECONNECT_DELAY = 3000 // 3 秒

// 消息存储大小限制（字节）
export const MAX_STORAGE_SIZE = 100 * 1024 * 1024 // 100 MB

// 端到端通话延迟目标（毫秒）
export const TARGET_LATENCY = 150

// 最大丢包率阈值（百分比）
export const MAX_PACKET_LOSS_THRESHOLD = 0.1 // 10%

// 消息分页大小
export const MESSAGE_PAGE_SIZE = 50

// 对话列表分页大小
export const CONVERSATION_PAGE_SIZE = 20

// 消息更新检查间隔（毫秒）
export const MESSAGE_SYNC_INTERVAL = 5000 // 5 秒

// 在线状态更新间隔（毫秒）
export const ONLINE_STATUS_UPDATE_INTERVAL = 10000 // 10 秒
