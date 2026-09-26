import { buildCoverPrompt, sniffImageType } from '../cover'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/db/db', () => ({ getDb: () => { throw new Error('db not needed') } }))
jest.mock('@/lib/api-access', () => ({ availableTtsAccess: jest.fn() }))
jest.mock('@/lib/settings', () => ({ getSetting: jest.fn(), getUserSetting: jest.fn() }))
jest.mock('../storage', () => ({ storeCover: jest.fn(), removeCover: jest.fn() }))

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
})
