import { isYoutubeSource, readableTaskError, safeSourceUrl, sourceUrlFor } from '../source'
import { PodcastInputType } from '../types'

it('keeps the full original article URL, including its query', () => {
  expect(
    sourceUrlFor({ type: PodcastInputType.Link, text: 'https://example.com/story?id=123' })
  ).toBe('https://example.com/story?id=123')
})

it('preserves explicit preview origins and recovers older video transcript headers', () => {
  const text =
    'YouTube 视频：TED\n来源：https://www.youtube.com/watch?v=rKgtm81yi94\n以下为视频字幕正文：\nHello'
  expect(sourceUrlFor({ type: PodcastInputType.LongText, text })).toBe(
    'https://www.youtube.com/watch?v=rKgtm81yi94'
  )
  expect(
    sourceUrlFor({ sourceUrl: 'https://b23.tv/example', type: PodcastInputType.LongText, text })
  ).toBe('https://b23.tv/example')
  expect(
    sourceUrlFor({
      type: PodcastInputType.LongText,
      text: '音频来源：https://example.com/episode\n以下为页面公开文字稿：\nHello',
    })
  ).toBe('https://example.com/episode')
})

it('does not expose arbitrary URLs mentioned in articles, topics, or file names', () => {
  for (const type of [PodcastInputType.LongText, PodcastInputType.Topic, PodcastInputType.File]) {
    expect(sourceUrlFor({ type, text: '来源：https://example.com/private' })).toBeUndefined()
  }
})

it('rejects executable links, credentials, invalid and oversized URLs', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hi',
    '/relative',
    'https://user:secret@example.com',
    'https://example.com/' + 'x'.repeat(2048),
  ]) {
    expect(safeSourceUrl(url)).toBeUndefined()
  }
  expect(sourceUrlFor(null)).toBeUndefined()
})

it('preflights only real YouTube hosts', () => {
  expect(isYoutubeSource('https://www.youtube.com/watch?v=tJV-vdbZ388')).toBe(true)
  expect(isYoutubeSource('https://youtu.be/tJV-vdbZ388')).toBe(true)
  expect(isYoutubeSource('https://youtube.com.evil.example/watch?v=tJV-vdbZ388')).toBe(false)
  expect(isYoutubeSource('ordinary text')).toBe(false)
})

it('shows the underlying workflow error instead of internal step paths', () => {
  expect(
    readableTaskError(
      'FatalError: Step "step//./src/lib/podcast/workflow//prepareInput" failed after 3 retries: 无法取得 YouTube 字幕'
    )
  ).toBe('无法取得 YouTube 字幕')
  expect(readableTaskError('配音额度不足')).toBe('配音额度不足')
})
