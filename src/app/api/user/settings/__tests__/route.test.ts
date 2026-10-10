import { PUT } from '../route'

const mockGetCurrentUser = jest.fn()
const mockSetUserSetting = jest.fn()
const mockDelete = jest.fn()
const mockWhere = jest.fn()

jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockGetCurrentUser() }))
jest.mock('@/db/db', () => ({ getDb: () => ({ delete: mockDelete }) }))
jest.mock('@/lib/settings', () => ({
  SETTING_KEYS: [
    'SUPADATA_API_KEY',
    'SUPADATA_ENABLED',
    'LLM_CHAT_URL',
    'LLM_CHAT_MODEL',
    'LLM_API_KEY',
    'LLM_SEARCH_URL',
    'API_LLM_ENABLED',
    'API_TTS_ENABLED',
  ],
  getUserSettings: jest.fn(),
  setUserSetting: (...args: unknown[]) => mockSetUserSetting(...args),
}))
jest.mock('@/lib/api-access', () => ({ availableApiAccess: jest.fn() }))

const requestFor = (body: unknown) => ({ json: async () => body }) as Parameters<typeof PUT>[0]

describe('member API settings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ userId: 5, userEmail: 'member', isAdmin: false })
    mockWhere.mockResolvedValue(undefined)
    mockDelete.mockReturnValue({ where: mockWhere })
  })

  it('lets a member clear an optional URL without deleting a blank secret', async () => {
    const response = await PUT(requestFor({ LLM_SEARCH_URL: '', LLM_API_KEY: '' }))
    expect(response.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockSetUserSetting).not.toHaveBeenCalled()
  })

  it('rejects a bad URL without partially saving a valid model', async () => {
    const response = await PUT(
      requestFor({ LLM_CHAT_MODEL: 'new-model', LLM_CHAT_URL: 'http://unsafe.example' })
    )
    expect(response.status).toBe(400)
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockSetUserSetting).not.toHaveBeenCalled()
  })

  it('accepts the MiniMax mainland example shown in the configuration guide', async () => {
    const response = await PUT(
      requestFor({ LLM_CHAT_URL: 'https://api.minimax.cn/v1/chat/completions' })
    )
    expect(response.status).toBe(200)
    expect(mockSetUserSetting).toHaveBeenCalledWith(
      5,
      'LLM_CHAT_URL',
      'https://api.minimax.cn/v1/chat/completions'
    )
  })

  it('allows a member to pause their own LLM key without removing it', async () => {
    const response = await PUT(requestFor({ API_LLM_ENABLED: '0' }))
    expect(response.status).toBe(200)
    expect(mockSetUserSetting).toHaveBeenCalledWith(5, 'API_LLM_ENABLED', '0')
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('rejects invalid key control values', async () => {
    const response = await PUT(requestFor({ API_TTS_ENABLED: 'disabled' }))
    expect(response.status).toBe(400)
    expect(mockSetUserSetting).not.toHaveBeenCalled()
  })
})

it('does not allow a member to change platform subtitle fallback', async () => {
  mockGetCurrentUser.mockResolvedValue({ userEmail: 'member', userId: 1 })
  expect((await PUT(requestFor({ SUPADATA_API_KEY: 'private' }))).status).toBe(403)
})
