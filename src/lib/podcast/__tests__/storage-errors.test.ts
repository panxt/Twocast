import { storageUploadError } from '../storage-errors'
describe('user-facing storage failures', () => {
  it('distinguishes upload size from total capacity and rate limits', () => {
    expect(storageUploadError(413, '', '原文件').message).toContain('单文件大小上限')
    expect(storageUploadError(400, 'Storage quota exceeded', '音频').message).toContain('额度不足')
    expect(storageUploadError(507, '', '音频').message).toContain('额度不足')
    expect(storageUploadError(429, '', '封面').message).toContain('过于频繁')
  })
  it('does not expose raw storage responses', () => {
    expect(storageUploadError(500, 'private/path token=secret', '封面').message).not.toContain('secret')
  })
})
