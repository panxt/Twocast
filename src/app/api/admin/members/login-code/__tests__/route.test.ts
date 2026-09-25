import { createHash } from 'node:crypto'
import { POST } from '../route'

const mockGetCurrentUser = jest.fn()
const mockReturning = jest.fn()
const mockWhere = jest.fn(() => ({ returning: mockReturning }))
const mockSet = jest.fn(() => ({ where: mockWhere }))
const mockUpdate = jest.fn(() => ({ set: mockSet }))

jest.mock('@/utils/user', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  sha256: (value: string) => createHash('sha256').update(value).digest('hex'),
}))
jest.mock('@/db/db', () => ({ getDb: () => ({ update: mockUpdate }) }))

const requestFor = (body: unknown) => ({ json: async () => body }) as Parameters<typeof POST>[0]

describe('administrator member login-code recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ isAdmin: true })
    mockReturning.mockResolvedValue([{ id: 7 }])
  })

  it('rejects a member without changing any login code', async () => {
    mockGetCurrentUser.mockResolvedValue({ isAdmin: false })
    const response = await POST(requestFor({ userId: 7 }))
    expect(response.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns a one-time code and stores only its hash for an existing member', async () => {
    const response = await POST(requestFor({ userId: 7 }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.code).toMatch(/^[A-Z0-9_-]{32}$/)
    expect(mockSet).toHaveBeenCalledWith({ loginCodeHash: createHash('sha256').update(body.code).digest('hex') })
  })

  it('does not reveal a code for an unknown member', async () => {
    mockReturning.mockResolvedValue([])
    const response = await POST(requestFor({ userId: 999 }))
    expect(response.status).toBe(404)
    expect((await response.json()).code).toBeUndefined()
  })
})
