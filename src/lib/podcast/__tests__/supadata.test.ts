import axios from 'axios'
import { supadataTranscript, youtubeFallback } from '../supadata'
jest.mock('axios')
const mockSettings = jest.fn()
jest.mock('@/lib/settings', () => ({ getSettings: (...args: unknown[]) => mockSettings(...args) }))
const get = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(axios.create as jest.Mock).mockReturnValue({ get })
})
it('does not call the third party when disabled or missing a key', async () => {
  for (const config of [
    { SUPADATA_ENABLED: '0', SUPADATA_API_KEY: 'test-secret' },
    { SUPADATA_ENABLED: '1', SUPADATA_API_KEY: '' },
  ]) {
    mockSettings.mockResolvedValue(config)
    await expect(youtubeFallback('abcdefghijk', '免费提取失败')).rejects.toThrow('尚未启用或配置')
  }
  expect(get).not.toHaveBeenCalled()
})
it('uses only native subtitles, sends the key only in headers, and preserves source', async () => {
  mockSettings.mockResolvedValue({ SUPADATA_ENABLED: '1', SUPADATA_API_KEY: 'test-secret' })
  get.mockResolvedValue({
    status: 200,
    data: { content: 'Real transcript text. '.repeat(10), lang: 'en' },
  })
  const text = await youtubeFallback('abcdefghijk', 'failed')
  expect(text).toContain('来源：https://www.youtube.com/watch?v=abcdefghijk')
  expect(text).toContain('字幕语言：en')
  expect(text).not.toContain('test-secret')
  expect(get.mock.calls[0][1].params).toEqual({
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
    text: true,
    mode: 'native',
  })
  expect(get.mock.calls[0][1].headers).toEqual({ 'x-api-key': 'test-secret' })
})
it.each([
  [401, 'Key 无效'],
  [402, '额度不足'],
  [429, '过于频繁'],
  [404, '均未取得正文'],
  [202, '均未取得正文'],
])('returns a safe actionable error for HTTP %s', async (status, message) => {
  get.mockResolvedValue({ status, data: { error: 'test-secret' } })
  await expect(supadataTranscript('abcdefghijk', 'test-secret')).rejects.toThrow(message)
})
it('rejects short text and excessive input', async () => {
  for (const content of ['', 'x'.repeat(100_001)]) {
    get.mockResolvedValue({ status: 200, data: { content } })
    await expect(supadataTranscript('abcdefghijk', 'test-secret')).rejects.toThrow()
  }
})
it('rejects unvalidated IDs before sending a request', async () => {
  await expect(supadataTranscript('invalid', 'test-secret')).rejects.toThrow('无效')
  expect(get).not.toHaveBeenCalled()
})
it('never leaks credentials from network errors', async () => {
  (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true)
  get.mockRejectedValue(new Error('test-secret'))
  await expect(supadataTranscript('abcdefghijk', 'test-secret')).rejects.toThrow('连接失败或超时')
  ;(axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false)
})
