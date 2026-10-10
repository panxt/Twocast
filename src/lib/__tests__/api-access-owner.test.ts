import { availableTtsAccess, availableApiAccess } from '../api-access'
import { Platform } from '../podcast/types'

jest.mock('server-only', () => ({}), { virtual: true })
const mockGlobalSettings = jest.fn()
const mockOwnSettings = jest.fn()
const mockRows = jest.fn()
jest.mock('../settings', () => ({
  getSettings: (...args: unknown[]) => mockGlobalSettings(...args),
  getUserSettings: (...args: unknown[]) => mockOwnSettings(...args),
}))
jest.mock('@/db/db', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ orderBy: mockRows }) }) }),
  }),
}))

describe('platform API owner isolation', () => {
  const admin = { userId: 1, inviteCodeId: null, isAdmin: true }
  beforeEach(() => {
    jest.clearAllMocks()
    mockGlobalSettings.mockResolvedValue({ MINIMAX_TOKEN: 'test', MINIMAX_GROUP_ID: 'test' })
    mockOwnSettings.mockResolvedValue({})
    mockRows.mockResolvedValue([])
  })
  it('does not give ordinary administrators automatic use of the owner API', async () => {
    const result = await availableTtsAccess(admin)
    expect(result.error).toContain('未获管理员共享')
    expect(mockGlobalSettings).toHaveBeenCalledWith(['API_DEFAULT_SHARED_ENABLED'])
  })
  it('allows members without private keys to use enabled default chat and MiniMax', async () => {
    mockGlobalSettings.mockResolvedValue({
      API_DEFAULT_SHARED_ENABLED: '1',
      MINIMAX_TOKEN: 'test',
      MINIMAX_GROUP_ID: 'test',
      LLM_CHAT_URL: 'https://test.example',
      LLM_CHAT_MODEL: 'test',
      LLM_API_KEY: 'test',
    })
    const result = await availableApiAccess({ ...admin, isAdmin: false }, false)
    expect(result).toEqual({ llm: { source: 'default' }, tts: { source: 'default' } })
  })
  it('keeps private keys ahead of default sharing', async () => {
    mockOwnSettings.mockResolvedValue({ MINIMAX_TOKEN: 'own-test', MINIMAX_GROUP_ID: 'own-test' })
    expect(await availableTtsAccess(admin)).toEqual({ source: 'own' })
    expect(mockGlobalSettings).not.toHaveBeenCalled()
  })
  it('does not default-share other TTS providers', async () => {
    mockGlobalSettings.mockResolvedValue({
      API_DEFAULT_SHARED_ENABLED: '1',
      GEMINI_TTS_API_KEY: 'test',
    })
    expect((await availableTtsAccess(admin, Platform.Gemini)).error).toContain('未获管理员共享')
  })
  it('reports a stopped global API instead of allowing default access', async () => {
    mockGlobalSettings.mockResolvedValue({
      API_DEFAULT_SHARED_ENABLED: '1',
      API_TTS_ENABLED: '0',
      MINIMAX_TOKEN: 'test',
      MINIMAX_GROUP_ID: 'test',
    })
    expect((await availableTtsAccess(admin)).error).toContain('停用')
  })
  it('does not grant default access to an unauthenticated user', async () => {
    mockGlobalSettings.mockResolvedValue({ API_DEFAULT_SHARED_ENABLED: '1' })
    expect(
      (await availableTtsAccess({ userId: 0, inviteCodeId: null, isAdmin: false })).error
    ).toContain('未获管理员共享')
    expect(mockGlobalSettings).not.toHaveBeenCalled()
  })
  it('lets the super administrator use their platform API', async () => {
    expect(await availableTtsAccess({ ...admin, isSuperAdmin: true })).toEqual({ source: 'admin' })
    expect(mockRows).not.toHaveBeenCalled()
  })
})
