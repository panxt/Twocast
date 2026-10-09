import { POST } from '../route'
const mockUser = jest.fn()
const mockDb = jest.fn()
jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockUser(), sha256: () => '' }))
jest.mock('@/db/db', () => ({ getDb: () => mockDb() }))
const req = (role: string) =>
  new Request('https://example.test', {
    method: 'POST',
    body: JSON.stringify({ label: 'test', maxUses: 1, teamIds: [], accountRole: role }),
    headers: { 'content-type': 'application/json' },
  })
beforeEach(() => {
  jest.clearAllMocks()
  mockUser.mockResolvedValue({ isAdmin: true, isSuperAdmin: false })
})
it('ordinary admins cannot issue admin invitations', async () => {
  expect((await POST(req('admin'))).status).toBe(403)
  expect(mockDb).not.toHaveBeenCalled()
})
it('no invitation can grant super administrator privileges', async () => {
  mockUser.mockResolvedValue({ isAdmin: true, isSuperAdmin: true })
  expect((await POST(req('super_admin'))).status).toBe(403)
  expect(mockDb).not.toHaveBeenCalled()
})
