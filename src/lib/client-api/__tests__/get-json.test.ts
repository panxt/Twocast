import { getJson } from '../get-json'

describe('authenticated request deduplication', () => {
  const originalFetch = global.fetch
  afterEach(() => {
    global.fetch = originalFetch
  })
  it('shares concurrent reads but fetches fresh data after a completed request', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      redirected: false,
      json: async () => ({ userId: 1 }),
    })
    global.fetch = fetchMock
    const first = getJson('/test-me')
    const second = getJson('/test-me')
    expect(first).toBe(second)
    await Promise.all([first, second])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      redirected: false,
      json: async () => ({ userId: 2 }),
    })
    expect(await getJson('/test-me')).toEqual({ userId: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('shows a useful timeout message and allows the next request to recover', async () => {
    const timeout = new Error('timed out')
    timeout.name = 'TimeoutError'
    global.fetch = jest.fn().mockRejectedValue(timeout)
    await expect(getJson('/test-timeout')).rejects.toThrow('请求超时')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      redirected: false,
      json: async () => ({ recovered: true }),
    })
    expect(await getJson('/test-timeout')).toEqual({ recovered: true })
  })
  it('does not keep a failed or redirected session response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, redirected: true })
    await expect(getJson('/test-expired')).rejects.toThrow('登录已失效')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      redirected: false,
      json: async () => ({ authenticated: true }),
    })
    expect(await getJson('/test-expired')).toEqual({ authenticated: true })
  })
})
