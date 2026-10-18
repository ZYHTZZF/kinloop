import { Capacitor } from '@capacitor/core'

const DEFAULT_DEV_API_ORIGIN = 'http://127.0.0.1:8787'
const DEFAULT_DEV_WS_ORIGIN = 'ws://127.0.0.1:8787'

function normalizeBaseUrl(rawValue: string | undefined, fallback: string) {
  if (!rawValue) return fallback
  return rawValue.endsWith('/') ? rawValue.slice(0, -1) : rawValue
}

function joinUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith('/')) return `${baseUrl}${path}`
  return `${baseUrl}/${path}`
}

function getDefaultApiOrigin() {
  if (typeof window === 'undefined') {
    return DEFAULT_DEV_API_ORIGIN
  }

  if (Capacitor.isNativePlatform()) {
    return normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL, DEFAULT_DEV_API_ORIGIN)
  }

  return window.location.origin
}

function getDefaultWsOrigin() {
  if (typeof window === 'undefined') {
    return DEFAULT_DEV_WS_ORIGIN
  }

  if (Capacitor.isNativePlatform()) {
    return normalizeBaseUrl(import.meta.env.VITE_WS_BASE_URL, DEFAULT_DEV_WS_ORIGIN)
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname || '127.0.0.1'
  const port = window.location.port && window.location.port !== '5173' ? window.location.port : '8787'

  return `${protocol}//${host}:${port}`
}

export function buildApiUrl(path: string) {
  const apiBasePath = import.meta.env.VITE_API_BASE_PATH ?? '/api'
  const normalizedApiPath = apiBasePath.startsWith('/') ? apiBasePath : `/${apiBasePath}`
  const origin = getDefaultApiOrigin()

  if (path.startsWith(normalizedApiPath)) {
    return joinUrl(origin, path)
  }

  return joinUrl(origin, `${normalizedApiPath}${path.startsWith('/') ? path : `/${path}`}`)
}

export function getApiOrigin() {
  return getDefaultApiOrigin()
}

export function getWebSocketOrigin() {
  return getDefaultWsOrigin()
}
