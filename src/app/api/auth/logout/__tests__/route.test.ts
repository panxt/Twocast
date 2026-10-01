import { deviceSessionsTable } from '@/db/schema'
import { POST } from '../route'

const mockCookie = jest.fn()
const mockWhere = jest.fn()
const mockSet = jest.fn((_change: Record<string, unknown>) => ({ where: mockWhere }))
const mockDelete = jest.fn((_table: unknown) => ({ where: mockWhere }))
jest.mock('next/headers', () => ({ cookies: async () => ({ get: mockCookie }) }))
jest.mock('@/db/db', () => ({
  getDb: () => ({ update: () => ({ set: mockSet }), delete: mockDelete }),
}))

describe('logout preserves the recoverable account', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWhere.mockResolvedValue(undefined)
  })
  it('revokes the old browser token and cookie without deleting the account or code', async () => {
    const oldToken = 'a'.repeat(64)
    mockCookie.mockReturnValue({ value: oldToken })
    const response = await POST()
    expect(response.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith(deviceSessionsTable)
    expect(mockSet).not.toHaveBeenCalled()
    expect(response.headers.get('set-cookie')).toContain('twocast_session=;')
  })
  it('allows an already logged-out browser to leave without touching accounts', async () => {
    mockCookie.mockReturnValue(undefined)
    expect((await POST()).status).toBe(200)
    expect(mockSet).not.toHaveBeenCalled()
  })
})
