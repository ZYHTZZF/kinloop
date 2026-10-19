import { mockApiGet, mockApiPatch, mockApiPost } from './mockApi'
import { buildApiUrl } from '../../platform/apiConfig'
import { getStoredAuthToken } from '../../app/onboardingStorage'

async function parseJson(response: Response) {
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      const payload = await response.json()
      const message =
        typeof payload?.error === 'string'
          ? payload.error
          : typeof payload?.message === 'string'
            ? payload.message
            : `Request failed: ${response.status}`
      throw new Error(message)
    }

    const text = await response.text()
    const safeText = /<html|<body|<pre/i.test(text)
      ? `Request failed: ${response.status}`
      : text

    throw new Error(safeText || `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export function createApiHeaders(extraHeaders: Record<string, string> = {}) {
  const token = getStoredAuthToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  try {
    const response = await fetch(buildApiUrl(path), {
      headers: createApiHeaders(),
    })
    return (await parseJson(response)) as T
  } catch (error) {
    return handleMockFallback('GET', path, error)
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(buildApiUrl(path), {
      method: 'POST',
      headers: createApiHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    })

    return (await parseJson(response)) as T
  } catch (error) {
    return handleMockFallback('POST', path, error, body)
  }
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(buildApiUrl(path), {
      method: 'PATCH',
      headers: createApiHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    })

    return (await parseJson(response)) as T
  } catch (error) {
    return handleMockFallback('PATCH', path, error, body)
  }
}

async function handleMockFallback<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  error: unknown,
  body?: unknown,
): Promise<T> {
  if (!shouldUseMock(error)) {
    throw error
  }

  if (method === 'GET') {
    return mockApiGet<T>(path)
  }

  if (method === 'POST') {
    return mockApiPost<T>(path, body)
  }

  return mockApiPatch<T>(path, body)
}

function shouldUseMock(error: unknown) {
  if (!(error instanceof Error)) return false
  return /Failed to fetch|Load failed|Request failed: 5\d\d|502|503|504/i.test(error.message)
}
