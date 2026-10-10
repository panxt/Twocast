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
it('rejects named invitations that can create multiple accounts', async () => {
  const response = await POST(
    new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify({
        label: 'internal note',
        initialDisplayName: '小林',
        maxUses: 2,
        teamIds: [],
        accountRole: 'member',
      }),
    })
  )
  expect(response.status).toBe(400)
  expect(mockDb).not.toHaveBeenCalled()
})
it('stores a trimmed initial name separately from the management note', async () => {
  const values = jest.fn(() => ({ returning: async () => [{ id: 1 }] }))
  mockDb.mockReturnValue({
    transaction: async (fn: (tx: unknown) => Promise<void>) => fn({ insert: () => ({ values }) }),
  })
  const response = await POST(
    new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify({
        label: '运营组',
        initialDisplayName: ' 小林 ',
        maxUses: 1,
        teamIds: [],
        accountRole: 'member',
      }),
    })
  )
  expect(response.status).toBe(200)
  expect(values).toHaveBeenCalledWith(
    expect.objectContaining({ label: '运营组', initialDisplayName: '小林', maxUses: 1 })
  )
})
