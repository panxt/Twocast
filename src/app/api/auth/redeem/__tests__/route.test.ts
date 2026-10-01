import { POST } from '../route'
const mockReturning = jest.fn()
const mockInsert = jest.fn()
const mockSet = jest.fn((_change: Record<string, unknown>) => ({ where: () => ({ returning: mockReturning }) }))
jest.mock('@/db/db', () => ({ getDb: () => ({ update: () => ({ set: mockSet }), insert: mockInsert }) }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

describe('personal login-code recovery', () => {
  beforeEach(() => { jest.clearAllMocks() })
  it.each(['admin', 'member'])('restores the existing %s identity and permission', async role => {
    mockReturning.mockResolvedValue([{ id: 7, role }])
    const response = await POST({ json: async () => ({ code: 'RECOVERY-CODE-FOR-TEST-ONLY-123456' }) } as Parameters<typeof POST>[0])
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, role })
    expect(mockInsert).not.toHaveBeenCalled()
    expect(mockSet.mock.calls[0][0]).toEqual({ tokenHash: expect.any(String), expiresAt: expect.any(Date) })
    expect(response.headers.get('set-cookie')).toContain('twocast_session=')
  })
})
