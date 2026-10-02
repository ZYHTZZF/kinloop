const DEFAULT_API_PORT = '8787'

export function getWebSocketUrl() {
  if (typeof window === 'undefined') {
    return `ws://127.0.0.1:${DEFAULT_API_PORT}`
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname || '127.0.0.1'
  const port = resolveWebSocketPort(window.location.port)

  return `${protocol}//${host}:${port}`
}

function resolveWebSocketPort(currentPort: string) {
  if (!currentPort || currentPort === '5173') {
    return DEFAULT_API_PORT
  }

  return currentPort
}
