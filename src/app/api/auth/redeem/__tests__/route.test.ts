import { POST } from '../route'
const mockReturning = jest.fn()
const mockValues = jest.fn().mockResolvedValue(undefined)
const mockInsert = jest.fn((_table: unknown) => ({ values: mockValues }))
const mockSet = jest.fn((_change: Record<string, unknown>) => ({
  where: () => ({ returning: mockReturning }),
}))
jest.mock('@/db/db', () => ({
  getDb: () => ({
    update: () => ({ set: mockSet }),
    insert: mockInsert,
    select: () => ({ from: () => ({ where: async () => [] }) }),
  }),
}))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

describe('personal login-code recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  it.each(['super_admin', 'admin', 'member'])(
    'restores the existing %s identity and permission',
    async (role) => {
      mockReturning.mockResolvedValue([{ id: 7, role }])
      const response = await POST({
        json: async () => ({ code: 'RECOVERY-CODE-FOR-TEST-ONLY-123456' }),
      } as Parameters<typeof POST>[0])
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true, role })
      expect(mockInsert).toHaveBeenCalledTimes(1)
      expect(mockValues).toHaveBeenCalledWith({
        userId: 7,
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      })
      expect(mockSet.mock.calls[0][0]).toEqual({
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      })
      expect(response.headers.get('set-cookie')).toContain('twocast_session=')
    }
  )
})

it('initialises a new account with the invitation name, not its management note', async () => {
  mockReturning
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { id: 3, teamAccess: false, accountRole: 'member', initialDisplayName: '小林' },
    ])
  mockValues.mockReturnValueOnce({ returning: async () => [{ id: 17 }] })
  const response = await POST({
    json: async () => ({ code: 'INVITATION-NAME-TEST-ONLY-12345' }),
  } as Parameters<typeof POST>[0])
  expect(response.status).toBe(200)
  expect(mockValues).toHaveBeenCalledWith(
    expect.objectContaining({ inviteCodeId: 3, displayName: '小林', role: 'member' })
  )
})
