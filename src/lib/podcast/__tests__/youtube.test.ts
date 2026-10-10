import { captionText, playerResponse, youtubeVideoId, extractYoutubeTranscript } from '../youtube'
import axios from 'axios'
jest.mock('axios')

describe('YouTube transcript input', () => {
  it('recognizes video links without confusing other hosts', () => {
    for (const url of [
      'https://youtu.be/abcdefghijk?t=3',
      'https://www.youtube.com/watch?v=abcdefghijk',
      'https://m.youtube.com/shorts/abcdefghijk',
      'https://www.youtube.com/live/abcdefghijk',
    ])
      expect(youtubeVideoId(url)).toBe('abcdefghijk')
    expect(youtubeVideoId('https://youtube.com.evil.example/watch?v=abcdefghijk')).toBeNull()
    expect(() => youtubeVideoId('https://www.youtube.com/playlist?list=123')).toThrow('单个')
  })
  it('parses nested JSON without executing page scripts', () => {
    expect(
      playerResponse(
        'var ytInitialPlayerResponse = {"videoDetails":{"title":"a } \\" b"}}; alert(1)'
      )
    ).toEqual({ videoDetails: { title: 'a } " b' } })
  })
  it('decodes captions and ignores timing-only events', () => {
    expect(
      captionText(
        JSON.stringify({
          events: [
            { segs: [{ utf8: 'Hello &amp; ' }, { utf8: 'world' }] },
            {},
            { segs: [{ utf8: 'Hello &amp; world' }] },
            { segs: [{ utf8: 'Next line' }] },
          ],
        })
      )
    ).toBe('Hello & world\nNext line')
    expect(
      captionText(
        '<transcript><text start="0">Hello &amp; world</text><text start="1">Next</text></transcript>'
      )
    ).toBe('Hello & world\nNext')
  })
  it('uses actual captions and prefers human tracks', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data:
          'var ytInitialPlayerResponse = ' +
          JSON.stringify({
            videoDetails: { title: 'Demo' },
            captions: {
              playerCaptionsTracklistRenderer: {
                captionTracks: [
                  {
                    kind: 'asr',
                    baseUrl: 'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en',
                  },
                  {
                    baseUrl: 'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=zh',
                    languageCode: 'zh',
                  },
                ],
              },
            },
          }) +
          ';',
      })
      .mockResolvedValueOnce({
        data: JSON.stringify({
          events: [{ segs: [{ utf8: '这是实际的中文字幕内容。'.repeat(12) }] }],
        }),
      })
    ;(axios.create as jest.Mock).mockReturnValue({ get })
    expect(await extractYoutubeTranscript('abcdefghijk')).toContain('实际的中文字幕内容')
    expect(get.mock.calls[1][0]).toContain('lang=zh')
  })
  it('rejects title-only pages and empty captions with actionable guidance', async () => {
    ;(axios.create as jest.Mock).mockReturnValue({
      get: jest.fn().mockResolvedValue({
        data: 'var ytInitialPlayerResponse = {"videoDetails":{"title":"not content"}};',
      }),
    })
    await expect(extractYoutubeTranscript('abcdefghijk')).rejects.toThrow('显示文字稿')
  })
})
