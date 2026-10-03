export const CHAT_IMAGE_MAX_SIZE_MB = 8
export const CHAT_VIDEO_MAX_SIZE_MB = 15

const CHAT_IMAGE_MAX_SIZE = CHAT_IMAGE_MAX_SIZE_MB * 1024 * 1024
const CHAT_VIDEO_MAX_SIZE = CHAT_VIDEO_MAX_SIZE_MB * 1024 * 1024

export function ensureChatImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('只能发送图片文件')
  }

  if (file.size > CHAT_IMAGE_MAX_SIZE) {
    throw new Error(`图片不能超过 ${CHAT_IMAGE_MAX_SIZE_MB}MB`)
  }

  return file
}

export function ensureChatVideoFile(file: File) {
  if (!file.type.startsWith('video/')) {
    throw new Error('只能发送视频文件')
  }

  if (file.size > CHAT_VIDEO_MAX_SIZE) {
    throw new Error(`视频不能超过 ${CHAT_VIDEO_MAX_SIZE_MB}MB`)
  }

  return file
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('文件读取失败'))
    }

    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

export function getPlayableVideoUrl(mediaUrl: string | null | undefined) {
  if (!mediaUrl) {
    return null
  }

  if (
    mediaUrl.startsWith('data:video/') ||
    mediaUrl.startsWith('blob:') ||
    mediaUrl.startsWith('http://') ||
    mediaUrl.startsWith('https://')
  ) {
    return mediaUrl
  }

  return null
}
