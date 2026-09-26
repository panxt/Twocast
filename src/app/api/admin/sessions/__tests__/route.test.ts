import { DELETE } from '../route'

const mockUser = jest.fn()
const mockUpdateReturning = jest.fn()
const mockDeleteReturning = jest.fn()
const mockUpdateWhere = jest.fn()
const mockDeleteWhere = jest.fn()

jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockUser() }))
jest.mock('@/db/db', () => ({ getDb: () => ({
  update: () => ({ set: () => ({ where: mockUpdateWhere }) }),
  delete: () => ({ where: mockDeleteWhere }),
}) }))

describe('admin session revocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning })
    mockDeleteWhere.mockReturnValue({ returning: mockDeleteReturning })
    mockUpdateReturning.mockResolvedValue([{ id: 2 }, { id: 3 }])
    mockDeleteReturning.mockResolvedValue([{ id: 4 }, { id: 5 }, { id: 6 }])
  })

  it('refuses non-admins before touching the database', async () => {
    mockUser.mockResolvedValue({ isAdmin: false, userId: 9 })
    expect((await DELETE()).status).toBe(403)
    expect(mockUpdateWhere).not.toHaveBeenCalled()
    expect(mockDeleteWhere).not.toHaveBeenCalled()
  })

  it('revokes the other live admin sessions and purges stale unused ones', async () => {
    mockUser.mockResolvedValue({ isAdmin: true, userId: 1 })
    const response = await DELETE()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revoked: 2, purged: 3 })
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1)
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1)
  })
})
