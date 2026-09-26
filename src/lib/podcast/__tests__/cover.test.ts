import { buildCoverPrompt, generateCover, sniffImageType } from '../cover'
import { availableTtsAccess } from '@/lib/api-access'
import { getSetting } from '@/lib/settings'
import { storeCover } from '../storage'
import { Platform } from '../types'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/db/db', () => ({ getDb: () => ({ update: () => ({ set: () => ({ where: async () => [] }) }) }) }))
jest.mock('@/lib/api-access', () => ({ availableTtsAccess: jest.fn() }))
jest.mock('@/lib/settings', () => ({ getSetting: jest.fn(), getUserSetting: jest.fn() }))
jest.mock('../storage', () => ({ storeCover: jest.fn(), removeCover: jest.fn() }))
jest.mock('../task', () => ({ taskGetStepItem: () => ({ input: { title: '测试节目', outline: '封面测试' } }) }))

describe('episode cover helpers', () => {
  it('recognises real image headers instead of trusting the declared type', () => {
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe('image/png')
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg')
    expect(sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]))).toBe('image/webp')
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  })

  it('writes a prompt from the episode, strips markdown and forbids text in the picture', () => {
    const prompt = buildCoverPrompt('海外仓月度对账 SOP', '# 大纲\n- 仓租口径\n- **尾程配送费**', '集装箱')
    expect(prompt).toContain('海外仓月度对账 SOP')
    expect(prompt).toContain('仓租口径 尾程配送费')
    expect(prompt).toContain('集装箱')
    expect(prompt).not.toContain('#')
    expect(prompt).toContain('不要出现任何文字')
  })

  it('uses the existing MiniMax key and image API by default', async () => {
    jest.mocked(availableTtsAccess).mockResolvedValue({ source: 'admin' })
    jest.mocked(getSetting).mockResolvedValue('test-minimax-key')
    jest.mocked(storeCover).mockResolvedValue('supabase-cover:test.jpg')
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({
      base_resp: { status_code: 0 }, data: { image_base64: [image.toString('base64')] },
    }) })
    const originalFetch = global.fetch
    global.fetch = fetchMock
    try {
      const location = await generateCover({ userId: 1, inviteCodeId: null, isAdmin: true },
        { id: 2, uuid: 'episode-test', coverLocation: null } as never)
      expect(location).toBe('supabase-cover:test.jpg')
      expect(availableTtsAccess).toHaveBeenCalledWith(expect.anything(), Platform.Minimax)
      expect(getSetting).toHaveBeenCalledWith('MINIMAX_TOKEN')
      expect(fetchMock).toHaveBeenCalledWith('https://api.minimax.cn/v1/image_generation', expect.objectContaining({
        method: 'POST', headers: expect.objectContaining({ authorization: 'Bearer test-minimax-key' }),
      }))
      expect(jest.mocked(storeCover).mock.calls[0][2]).toBe('image/jpeg')
    } finally { global.fetch = originalFetch }
  })
})
