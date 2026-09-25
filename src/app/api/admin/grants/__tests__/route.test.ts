import { POST } from '../route'

const mockInsert = jest.fn()
const mockValues = jest.fn()
const mockReturning = jest.fn()

jest.mock('@/utils/user', () => ({ getCurrentUser: async () => ({ isAdmin: true }) }))
jest.mock('@/db/db', () => ({ getDb: () => ({ insert: mockInsert }) }))

const requestFor = (capability: string) => ({ json: async () => ({
  capability, userId: 5, maxEpisodes: 3,
}) }) as Parameters<typeof POST>[0]

describe('provider-specific team API grants', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockInsert.mockReturnValue({ values: mockValues })
    mockValues.mockReturnValue({ returning: mockReturning })
    mockReturning.mockResolvedValue([{ id: 1 }])
  })

  it('does not accept a generic TTS grant that could expose every provider', async () => {
    expect((await POST(requestFor('tts'))).status).toBe(400)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('grants only the selected provider', async () => {
    expect((await POST(requestFor('tts:fish_audio'))).status).toBe(200)
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ capability: 'tts:fish_audio' }))
  })
})
