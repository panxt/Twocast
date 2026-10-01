import { createHash } from 'node:crypto'
import { POST } from '../route'
const mockUser = jest.fn()
const mockWhere = jest.fn()
const mockSet = jest.fn((_change: Record<string, unknown>) => ({ where: mockWhere }))
jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockUser(), sha256: (s: string) => createHash('sha256').update(s).digest('hex') }))
jest.mock('@/db/db', () => ({ getDb: () => ({ update: () => ({ set: mockSet }) }) }))

describe('personal login codes', () => {
  beforeEach(() => { jest.clearAllMocks(); mockWhere.mockResolvedValue(undefined) })
  it.each([false, true])('allows authenticated members and administrators (admin=%s)', async isAdmin => {
    mockUser.mockResolvedValue({ userId: 5, userEmail: 'account', isAdmin })
    const response = await POST()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.code).toMatch(/^[A-Z0-9_-]{32}$/)
    expect(mockSet).toHaveBeenCalledWith({ loginCodeHash: createHash('sha256').update(body.code).digest('hex') })
  })
  it('rejects unauthenticated and local bypass identities', async () => {
    mockUser.mockResolvedValue({ userId: 0, userEmail: '' })
    expect((await POST()).status).toBe(401)
    mockUser.mockResolvedValue({ userId: 0, userEmail: 'local', isAdmin: true })
    expect((await POST()).status).toBe(400)
    expect(mockSet).not.toHaveBeenCalled()
  })
})
