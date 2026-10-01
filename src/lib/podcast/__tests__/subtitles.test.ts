import { parseSubtitles, toSrt } from '../subtitles'
it('preserves LRC multi timestamps and fractional times', () => {
  expect(parseSubtitles('[00:01.5][01:03.012]字幕')).toEqual([
    { role: '讲述', text: '字幕', startMs: 1500 },
    { role: '讲述', text: '字幕', startMs: 63012 },
  ])
})
it('reads multiline SRT and rejects text without timing', () => {
  expect(parseSubtitles('1\n00:01:02,003 --> 00:01:04,000\n第一行\n第二行')[0]).toEqual({
    role: '讲述',
    text: '第一行 第二行',
    startMs: 62003,
  })
  expect(() => parseSubtitles('没有时间戳')).toThrow()
})
it('writes exportable SRT times', () => {
  expect(toSrt([{ role: 'host', text: '测试', startMs: 1500 }], 5)).toContain(
    '00:00:01,500 --> 00:00:05,000'
  )
})
