import { GET } from '../route'
const mockUser = jest.fn()
const mockSelect = jest.fn()
const mockExecute = jest.fn()
jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockUser() }))
jest.mock('@/db/db', () => ({ getDb: () => ({ select: mockSelect, execute: mockExecute }) }))
jest.mock('@/lib/podcast/scope', () => ({ taskScopeWhere: () => undefined }))
function rows(value: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const name of ['from', 'where', 'leftJoin', 'groupBy', 'orderBy']) chain[name] = () => chain
  chain.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(value).then(resolve)
  return chain
}
describe('dashboard failures', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUser.mockResolvedValue({
      userId: 1,
      userEmail: 'admin@test.invalid',
      isAdmin: true,
      teamIds: [],
    })
    mockSelect.mockImplementation(() => rows([]))
  })
  it('keeps the dashboard available if optional storage statistics fail', async () => {
    mockExecute.mockRejectedValue(new Error('storage unavailable'))
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const response = await GET(new Request('https://example.test/api/protected/dashboard'))
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.platformStorage).toBeNull()
      expect(data.notes).toContain('存储总量暂时不可用；其他用量统计正常。')
      expect(data.isAdmin).toBe(true)
    } finally {
      log.mockRestore()
    }
  })
  it('returns a readable JSON error for database failures', async () => {
    mockSelect.mockImplementation(() => {
      throw new Error('database unavailable')
    })
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const response = await GET(new Request('https://example.test/api/protected/dashboard'))
      expect(response.status).toBe(503)
      expect((await response.json()).error).toBe('用量概览暂时无法加载，请稍后重试。')
    } finally {
      log.mockRestore()
    }
  })
})
