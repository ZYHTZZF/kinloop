import { mockApiGet, mockApiPatch, mockApiPost } from './mockApi'

const API_BASE = '/api'

async function parseJson(response: Response) {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }

  return response.json()
}

export async function apiGet<T>(path: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`)
    return (await parseJson(response)) as T
  } catch (error) {
    return handleMockFallback('GET', path, error)
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    return (await parseJson(response)) as T
  } catch (error) {
    return handleMockFallback('POST', path, error, body)
  }
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
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
