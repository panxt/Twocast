import { GET } from '../route'
const user = jest.fn(),
  task = jest.fn(),
  access = jest.fn()
jest.mock('@/utils/user', () => ({ getCurrentUser: () => user() }))
jest.mock('@/models/task', () => ({ getTaskByUuid: () => task() }))
jest.mock('@/lib/podcast/access', () => ({ canReadTask: () => access() }))
const context = { params: Promise.resolve({ uuid: 'episode' }) }
beforeEach(() => {
  jest.clearAllMocks()
  user.mockResolvedValue({ userEmail: 'member' })
  access.mockReturnValue(true)
  task.mockResolvedValue({
    stepsDetail: { audio: { input: { title: '团队/报告' } } },
    userInputs: {
      type: 'long-text',
      sourceUrl: 'https://youtube.com/watch?v=abcdefghijk',
      text: 'Actual source transcript. <script>not executable</script>',
    },
  })
})
it('returns the stored source, never the generated podcast script', async () => {
  const r = await GET(new Request('https://site/api/source-text'), context)
  expect(await r.text()).toContain('Actual source transcript.')
  expect(r.headers.get('Content-Type')).toContain('text/plain')
  expect(r.headers.get('Cache-Control')).toBe('private, no-store')
})
it('supports downloading a copy of the same source', async () => {
  const r = await GET(new Request('https://site/api/source-text?download=1'), context)
  expect(r.headers.get('Content-Disposition')).toContain('attachment')
  expect(r.headers.get('Content-Disposition')).toContain(
    encodeURIComponent('团队 报告-源文字稿.txt')
  )
})
it('protects private source text and requires sign-in', async () => {
  access.mockReturnValue(false)
  expect((await GET(new Request('https://site/api/source-text'), context)).status).toBe(404)
  user.mockResolvedValue({ userEmail: '' })
  expect((await GET(new Request('https://site/api/source-text'), context)).status).toBe(401)
})
it('reports missing source text without refetching the provider', async () => {
  task.mockResolvedValue({
    userInputs: { type: 'link', text: 'https://youtube.com/watch?v=abcdefghijk' },
  })
  expect((await GET(new Request('https://site/api/source-text'), context)).status).toBe(404)
})
