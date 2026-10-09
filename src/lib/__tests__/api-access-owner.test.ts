import { availableTtsAccess } from '../api-access'

jest.mock('server-only', () => ({}), { virtual: true })
const mockGlobalSettings = jest.fn()
const mockOwnSettings = jest.fn()
const mockRows = jest.fn()
jest.mock('../settings', () => ({
  getSettings: (...args: unknown[]) => mockGlobalSettings(...args),
  getUserSettings: (...args: unknown[]) => mockOwnSettings(...args),
}))
jest.mock('@/db/db', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ orderBy: mockRows }) }) }),
  }),
}))

describe('platform API owner isolation', () => {
  const admin = { userId: 1, inviteCodeId: null, isAdmin: true }
  beforeEach(() => {
    jest.clearAllMocks()
    mockGlobalSettings.mockResolvedValue({ MINIMAX_TOKEN: 'test', MINIMAX_GROUP_ID: 'test' })
    mockOwnSettings.mockResolvedValue({})
    mockRows.mockResolvedValue([])
  })
  it('does not give ordinary administrators automatic use of the owner API', async () => {
    const result = await availableTtsAccess(admin)
    expect(result.error).toContain('未获管理员共享')
    expect(mockGlobalSettings).not.toHaveBeenCalled()
  })
  it('lets the super administrator use their platform API', async () => {
    expect(await availableTtsAccess({ ...admin, isSuperAdmin: true })).toEqual({ source: 'admin' })
    expect(mockRows).not.toHaveBeenCalled()
  })
})
