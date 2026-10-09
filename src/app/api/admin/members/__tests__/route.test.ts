import { PATCH, DELETE } from '../route'
const mockUser = jest.fn()
const mockTarget = jest.fn()
const mockUpdate = jest.fn()
const tx = {
  select: () => ({ from: () => ({ where: () => ({ for: mockTarget }) }) }),
  update: mockUpdate,
}
jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockUser() }))
jest.mock('@/db/db', () => ({
  getDb: () => ({ transaction: (fn: (value: unknown) => unknown) => fn(tx) }),
}))
const req = (body: unknown) => ({ json: async () => body }) as Parameters<typeof PATCH>[0]
beforeEach(() => {
  jest.clearAllMocks()
  mockUser.mockResolvedValue({ isAdmin: true, isSuperAdmin: false, userId: 20 })
  mockTarget.mockResolvedValue([{ id: 11, role: 'super_admin' }])
})
it('rejects an ordinary administrator disabling the super administrator', async () => {
  expect((await PATCH(req({ userId: 11, disabled: true }))).status).toBe(403)
  expect(mockUpdate).not.toHaveBeenCalled()
})
it('rejects self-demotion of the sole super administrator', async () => {
  mockUser.mockResolvedValue({ isAdmin: true, isSuperAdmin: true, userId: 11 })
  expect((await PATCH(req({ userId: 11, role: 'member' }))).status).toBe(403)
  expect(mockUpdate).not.toHaveBeenCalled()
})
it('rejects deleting the super administrator', async () => {
  mockUser.mockResolvedValue({ isAdmin: true, isSuperAdmin: true, userId: 11 })
  const r = { nextUrl: new URL('https://example.test?id=11') } as Parameters<typeof DELETE>[0]
  expect((await DELETE(r)).status).toBe(403)
  expect(mockUpdate).not.toHaveBeenCalled()
})
it('rejects an ordinary administrator promoting a member', async () => {
  mockTarget.mockResolvedValue([{ id: 40, role: 'member' }])
  expect((await PATCH(req({ userId: 40, role: 'admin' }))).status).toBe(403)
  expect(mockUpdate).not.toHaveBeenCalled()
})
