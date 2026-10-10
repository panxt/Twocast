import { sourceTextFor, sourceTextInfo } from '../source-text'
it('uses saved preflight text for a long-text source', () => {
  expect(
    sourceTextFor({
      userInputs: {
        type: 'long-text',
        sourceUrl: 'https://youtube.com/watch?v=abcdefghijk',
        text: 'real source',
      },
      stepsDetail: { audio: { input: { script: 'not source' } } },
    })
  ).toBe('real source')
})
it('uses extraction input for legacy link tasks and never the link alone', () => {
  const userInputs = { type: 'link', text: 'https://youtube.com/watch?v=abcdefghijk' }
  expect(
    sourceTextFor({ userInputs, stepsDetail: { 'long-text': { input: 'extracted source' } } })
  ).toBe('extracted source')
  expect(sourceTextFor({ userInputs })).toBeNull()
})
it('shows known language and coverage without claiming completeness', () => {
  expect(sourceTextInfo('字幕语言：en\n字幕覆盖至：834.00 秒\n[13:50] Thank you').coverage).toBe(
    '13:54'
  )
  expect(sourceTextInfo('字幕语言：ar\nplain source').coverage).toBeNull()
  expect(sourceTextInfo('[00:00] hello\n[14:02] end').coverage).toBe('14:02')
})
