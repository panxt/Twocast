import { GET } from '../route'

const mockUser = jest.fn()
const mockTask = jest.fn()
const mockCanRead = jest.fn()
const mockAudioUrl = jest.fn()

jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockUser() }))
jest.mock('@/models/task', () => ({ getTaskByUuid: () => mockTask() }))
jest.mock('@/lib/podcast/access', () => ({ canReadTask: () => mockCanRead() }))
jest.mock('@/lib/podcast/task', () => ({ taskGetStepItem: () => ({
  input: { title: '团队/报告' }, output: { location: 'supabase:episode.mp3' },
}) }))
jest.mock('@/lib/podcast/storage', () => ({ getAudioUrl: (...args: unknown[]) => mockAudioUrl(...args) }))

const context = { params: Promise.resolve({ uuid: 'episode' }) }

describe('protected episode audio', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUser.mockResolvedValue({ userEmail: 'member@example.invalid' })
    mockTask.mockResolvedValue({ uuid: 'episode' })
    mockCanRead.mockReturnValue(true)
    mockAudioUrl.mockResolvedValue('https://storage.example.invalid/signed')
  })

  it('signs playback URLs only after an authorized request', async () => {
    const response = await GET(new Request('https://site.example.invalid/api/protected/tasks/episode/audio'), context)
    expect(response.status).toBe(307)
    expect(mockAudioUrl).toHaveBeenCalledWith('supabase:episode.mp3', undefined)
  })

  it('adds a safe filename for downloads', async () => {
    await GET(new Request('https://site.example.invalid/api/protected/tasks/episode/audio?download=1'), context)
    expect(mockAudioUrl).toHaveBeenCalledWith('supabase:episode.mp3', '团队 报告.mp3')
  })

  it('does not sign private audio for unauthorized users', async () => {
    mockCanRead.mockReturnValue(false)
    const response = await GET(new Request('https://site.example.invalid/api/protected/tasks/episode/audio'), context)
    expect(response.status).toBe(404)
    expect(mockAudioUrl).not.toHaveBeenCalled()
  })
})
