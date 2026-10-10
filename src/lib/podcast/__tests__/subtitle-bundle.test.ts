import { subtitleBundleEntries } from '../subtitle-bundle'

const audio = {
  location: 'supabase:test',
  duration: 240,
  timedScript: [{ role: '主持人', text: '中文播客', startMs: 2000 }],
}
const entriesFor = (text: string, language = 'Chinese') =>
  subtitleBundleEntries(
    {
      userInputs: {
        type: 'long-text',
        sourceUrl: 'https://youtube.com/watch?v=abcdefghijk',
        text,
        language,
      },
    },
    audio,
    '节目',
    '节目'
  )

it('preserves full source and keeps original and podcast timelines separate', () => {
  const source = '字幕语言：en\n[00:00] Beginning\n[14:55] Thank you.'
  const entries = entriesFor(source)
  expect(entries.find((e) => e.name === '源语言-原视频/完整文字稿.txt')?.data.toString()).toBe(
    source
  )
  expect(entries.find((e) => e.name === '源语言-原视频/字幕.lrc')?.data.toString()).toContain(
    '[14:55.00]'
  )
  expect(entries.find((e) => e.name === '节目.lrc')?.data.toString()).toContain(
    '[00:02.00]主持人: 中文播客'
  )
  expect(entries.find((e) => e.name === '目标语言-播客/脚本.txt')?.data.toString()).toContain(
    'Chinese'
  )
  expect(entries.find((e) => e.name === '节目.srt')?.data.toString()).toContain('00:04:00,000')
})

it.each(['English', 'German', 'Chinese'])(
  'records selected target %s without translating or refetching source',
  (language) => {
    const entries = entriesFor('Original English source.', language)
    expect(entries.find((e) => e.name === '目标语言-播客/脚本.txt')?.data.toString()).toContain(
      language
    )
    expect(entries.find((e) => e.name === '源语言-原视频/完整文字稿.txt')?.data.toString()).toBe(
      'Original English source.'
    )
    expect(entries.some((e) => e.name === '源语言-原视频/字幕.lrc')).toBe(false)
  }
)

it('does not truncate long source or fabricate source for old episodes', () => {
  const source = 'English source '.repeat(10000)
  expect(
    entriesFor(source)
      .find((e) => e.name === '源语言-原视频/完整文字稿.txt')
      ?.data.toString()
  ).toBe(source)
  const entries = subtitleBundleEntries(
    { userInputs: { type: 'link', text: 'https://youtube.com/watch?v=abcdefghijk' } },
    audio,
    'old',
    'old'
  )
  expect(entries.some((e) => e.name.startsWith('源语言'))).toBe(false)
  expect(entries.find((e) => e.name === '字幕说明.txt')?.data.toString()).toContain('未保存')
})
