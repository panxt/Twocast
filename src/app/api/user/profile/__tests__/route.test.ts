import { PATCH } from '../route'
import { PgDialect } from 'drizzle-orm/pg-core'
const mockUser = jest.fn()
const mockWhere = jest.fn().mockResolvedValue(undefined)
const mockSet = jest.fn(() => ({ where: mockWhere }))
jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockUser() }))
jest.mock('@/db/db', () => ({ getDb: () => ({ update: () => ({ set: mockSet }) }) }))
const request = (body: unknown) => ({ json: async () => body }) as Parameters<typeof PATCH>[0]
beforeEach(() => jest.clearAllMocks())
it.each(['member', 'admin', 'super_admin'])(
  'lets %s update only their own display name',
  async (role) => {
    mockUser.mockResolvedValue({
      userId: 10,
      userEmail: 'test@example.invalid',
      isAdmin: role !== 'member',
    })
    const response = await PATCH(
      request({ displayName: ' 小林 ', userId: 999, role: 'super_admin' })
    )
    expect(response.status).toBe(200)
    expect(mockSet).toHaveBeenCalledWith({ displayName: '小林' })
    expect(new PgDialect().sqlToQuery(mockWhere.mock.calls[0][0]).params).toEqual([10])
  }
)
it('rejects unauthenticated name changes', async () => {
  mockUser.mockResolvedValue({ userEmail: '' })
  expect((await PATCH(request({ displayName: '小林' }))).status).toBe(401)
  expect(mockSet).not.toHaveBeenCalled()
})
it.each(['   ', 'x'.repeat(41)])('rejects invalid names', async (displayName) => {
  mockUser.mockResolvedValue({ userId: 10, userEmail: 'test@example.invalid' })
  expect((await PATCH(request({ displayName }))).status).toBe(400)
  expect(mockSet).not.toHaveBeenCalled()
})
