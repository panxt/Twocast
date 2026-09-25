import { GET, PUT } from '../route'

const mockGetCurrentUser = jest.fn()
const mockGetSettings = jest.fn()
const mockSetSetting = jest.fn()

jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockGetCurrentUser() }))
jest.mock('@/lib/settings', () => ({
  SETTING_KEYS: ['LLM_CHAT_URL', 'LLM_CHAT_MODEL', 'LLM_API_KEY', 'LLM_SEARCH_URL'],
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
  setSetting: (...args: unknown[]) => mockSetSetting(...args),
}))

const requestFor = (body: unknown) => ({ json: async () => body }) as Parameters<typeof PUT>[0]

describe('administrator API settings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ isAdmin: true })
    mockGetSettings.mockResolvedValue({ LLM_CHAT_URL: 'https://api.openai.com/v1', LLM_CHAT_MODEL: 'test',
      LLM_API_KEY: 'private-key', LLM_SEARCH_URL: '' })
  })

  it('reads settings in one batch without revealing a secret', async () => {
    const response = await GET()
    const body = await response.json()
    expect(mockGetSettings).toHaveBeenCalledTimes(1)
    expect(body.settings.LLM_API_KEY).toBe(true)
    expect(body.settings.LLM_CHAT_MODEL).toBe('test')
  })

  it('accepts an empty optional URL while retaining an empty secret field', async () => {
    const response = await PUT(requestFor({ LLM_CHAT_URL: 'https://api.openai.com/v1',
      LLM_SEARCH_URL: '', LLM_API_KEY: '' }))
    expect(response.status).toBe(200)
    expect(mockSetSetting).toHaveBeenCalledWith('LLM_SEARCH_URL', '')
    expect(mockSetSetting).not.toHaveBeenCalledWith('LLM_API_KEY', '')
  })

  it('validates every field before writing any setting', async () => {
    const response = await PUT(requestFor({ LLM_CHAT_MODEL: 'new-model', LLM_CHAT_URL: 'http://unsafe.example' }))
    expect(response.status).toBe(400)
    expect(mockSetSetting).not.toHaveBeenCalled()
  })
})
