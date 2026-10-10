import axios from 'axios'
import { extractBilibiliTranscript, isBilibiliUrl } from '../bilibili'
import { mediaSite, podcastPageTranscript, vttText } from '../media-sites'
import { findTranscriptParams, transcriptResponseText } from '../youtube'
jest.mock('axios')

describe('Media transcript adapters', () => {
  it('uses exact hosts and reads actual VTT/SRT cues', () => {
    expect(isBilibiliUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(true)
    expect(isBilibiliUrl('https://bilibili.com.evil.test')).toBe(false)
    expect(mediaSite('https://open.spotify.com/episode/id')).toBe('audio')
    expect(
      vttText(
        'WEBVTT\n\n00:00:03.000 --> 00:00:05.000\nHello <b>world</b>\n\n2\n00:01:02,000 --> 00:01:04,000\nNext'
      )
    ).toBe('[00:03] Hello world\n[01:02] Next')
  })
  it('reads YouTube Show transcript response with original times', () => {
    expect(findTranscriptParams({ panel: { getTranscriptEndpoint: { params: 'abc' } } })).toBe(
      'abc'
    )
    expect(
      transcriptResponseText({
        panel: [
          {
            transcriptSegmentRenderer: { startMs: '62000', snippet: { runs: [{ text: 'Hello' }] } },
          },
        ],
      })
    ).toBe('[01:02] Hello')
  })
  it('never treats show notes as an audio transcript', () => {
    expect(podcastPageTranscript('<main><h1>Episode</h1><p>Great show notes</p></main>')).toBe('')
    expect(
      podcastPageTranscript(
        '<script type="application/ld+json">{"@type":"PodcastEpisode","transcript":"Actual words"}</script>'
      )
    ).toBe('Actual words')
  })
  it('uses selected Bilibili part CID and real subtitle body', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: JSON.stringify({
          code: 0,
          data: {
            aid: 2,
            bvid: 'BV1xx411c7mD',
            title: 'Demo',
            pages: [
              { page: 1, cid: 11 },
              { page: 2, cid: 22 },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        data: JSON.stringify({
          code: 0,
          data: {
            subtitle: { subtitles: [{ subtitle_url: 'https://aisubtitle.hdslb.com/test.json' }] },
          },
        }),
      })
      .mockResolvedValueOnce({
        data: JSON.stringify({ body: [{ from: 62, content: 'Real video words '.repeat(10) }] }),
      })
    ;(axios.create as jest.Mock).mockReturnValue({ get })
    expect(
      await extractBilibiliTranscript('https://www.bilibili.com/video/BV1xx411c7mD?p=2')
    ).toContain('[01:02] Real video words')
    expect(get.mock.calls[1][1].params.cid).toBe(22)
  })
  it('refuses Bilibili subtitle URLs outside provider CDN', async () => {
    const get = jest
      .fn()
      .mockResolvedValueOnce({
        data: JSON.stringify({ code: 0, data: { aid: 2, pages: [{ page: 1, cid: 11 }] } }),
      })
      .mockResolvedValueOnce({
        data: JSON.stringify({
          code: 0,
          data: { subtitle: { subtitles: [{ subtitle_url: 'https://evil.example/secret' }] } },
        }),
      })
    ;(axios.create as jest.Mock).mockReturnValue({ get })
    await expect(
      extractBilibiliTranscript('https://www.bilibili.com/video/BV1xx411c7mD')
    ).rejects.toThrow('完整字幕')
    expect(get).toHaveBeenCalledTimes(2)
  })
})
