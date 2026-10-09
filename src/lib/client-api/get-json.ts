'use client'

// Share only requests that are in flight. Never retain authenticated data after completion.
const pendingRequests = new Map<string, Promise<unknown>>()

export function getJson<T = any>(path: string): Promise<T> {
  const existing = pendingRequests.get(path)
  if (existing) return existing as Promise<T>
  const pending = Promise.resolve().then(async () => {
    try {
      const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      if (response.redirected || response.status === 401) throw new Error('登录已失效，请重新登录')
      const body = await response.json().catch(() => {
        throw new Error('服务暂时无法响应，请稍后重试')
      })
      if (!response.ok) throw new Error(body.error || '加载失败')
      return body
    } finally {
      pendingRequests.delete(path)
    }
  })
  pendingRequests.set(path, pending)
  return pending as Promise<T>
}
