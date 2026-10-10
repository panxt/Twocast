import { POST } from '../route'
const mockUser = jest.fn()
const mockExtract = jest.fn()
jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockUser() }))
jest.mock('@/lib/podcast/youtube', () => ({
  youtubeVideoId: (url: string) =>
    new URL(url).hostname === 'www.youtube.com' ? 'abcdefghijk' : null,
  extractYoutubeTranscript: (id: string) => mockExtract(id),
}))
const request = (body: unknown) => ({ json: async () => body }) as Parameters<typeof POST>[0]
beforeEach(() => {
  jest.clearAllMocks()
  mockUser.mockResolvedValue({ userEmail: 'member@example.invalid' })
})
it('requires a logged-in member before fetching a source', async () => {
  mockUser.mockResolvedValue({ userEmail: '' })
  expect((await POST(request({ url: 'https://www.youtube.com/watch?v=abcdefghijk' }))).status).toBe(
    401
  )
  expect(mockExtract).not.toHaveBeenCalled()
})
it.each([
  'http://127.0.0.1/',
  'https://www.youtube.com:123/watch?v=abcdefghijk',
  'https://user:password@www.youtube.com/watch?v=abcdefghijk',
  'https://evil.example/',
])('rejects unsupported or unsafe source %s', async (url) => {
  expect((await POST(request({ url }))).status).toBe(422)
  expect(mockExtract).not.toHaveBeenCalled()
})
it('previews the full transcript without creating a generation task', async () => {
  mockExtract.mockResolvedValue('真实字幕 English transcript')
  const response = await POST(request({ url: 'https://www.youtube.com/watch?v=abcdefghijk' }))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ text: '真实字幕 English transcript', characters: 23 })
})
it('returns actionable parsing failures and rejects oversized text', async () => {
  mockExtract.mockRejectedValueOnce(new Error('请复制文字稿'))
  expect(
    await (await POST(request({ url: 'https://www.youtube.com/watch?v=abcdefghijk' }))).json()
  ).toEqual({ error: '请复制文字稿' })
  mockExtract.mockResolvedValueOnce('x'.repeat(100001))
  expect((await POST(request({ url: 'https://www.youtube.com/watch?v=abcdefghijk' }))).status).toBe(
    422
  )
})
