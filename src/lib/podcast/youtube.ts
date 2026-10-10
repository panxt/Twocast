import axios from 'axios'
import { mediaClient, timedLine } from './media-client'
import { load } from 'cheerio'

const hosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
])
const failure =
  '无法取得 YouTube 字幕：视频可能没有公开字幕、需要登录，或 YouTube 限制了服务器访问。请在 YouTube「显示文字稿」复制正文到「长文本」，或将字幕保存为 TXT / Markdown 上传后重试。'

export function youtubeVideoId(input: string): string | null {
  const url = new URL(input)
  if (!hosts.has(url.hostname.toLowerCase())) return null
  const id =
    url.hostname === 'youtu.be'
      ? url.pathname.split('/')[1]
      : url.pathname === '/watch'
        ? url.searchParams.get('v')
        : /^\/(shorts|embed|live)\//.test(url.pathname)
          ? url.pathname.split('/')[2]
          : null
  if (!id || !/^[\w-]{11}$/.test(id))
    throw new Error('请填写单个 YouTube 视频链接，不支持频道或播放列表链接。')
  return id
}

// Parse JSON as data; never evaluate scripts from the remote page.
export function playerResponse(html: string): any {
  return pageJson(html, 'ytInitialPlayerResponse')
}

export function pageJson(html: string, variable: 'ytInitialPlayerResponse' | 'ytInitialData'): any {
  const marker = new RegExp(`(?:var\\s+)?${variable}\\s*=\\s*`).exec(html)
  if (!marker) throw new Error(failure)
  const start = marker.index + marker[0].length
  let depth = 0,
    quoted = false,
    escaped = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') quoted = false
    } else if (ch === '"') quoted = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1))
  }
  throw new Error(failure)
}

export function captionText(raw: string, timestamps = false): string {
  let lines: string[]
  if (raw.trim().startsWith('{')) {
    const data = JSON.parse(raw)
    lines = (data.events || []).map((event: any) =>
      timestamps && event.segs?.length
        ? timedLine(
            Number(event.tStartMs) / 1000,
            (event.segs || []).map((segment: any) => segment.utf8 || '').join('')
          )
        : (event.segs || []).map((segment: any) => segment.utf8 || '').join('')
    )
  } else {
    const $ = load(raw, { xml: true })
    lines = $('text, p')
      .toArray()
      .map((element) =>
        timestamps
          ? timedLine(
              Number($(element).attr('start') || Number($(element).attr('t')) / 1000),
              $(element).text()
            )
          : $(element).text()
      )
  }
  const cleaned = lines
    .map((line) => load(`<body>${line}</body>`).text().replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return cleaned.filter((line, i) => i === 0 || line !== cleaned[i - 1]).join('\n')
}

export async function extractYoutubeTranscript(videoId: string): Promise<string> {
  const client = mediaClient()
  try {
    const { data: html } = await client.get(`https://www.youtube.com/watch?v=${videoId}&hl=en`)
    let player = playerResponse(html)
    const title = player.videoDetails?.title || videoId
    const wrap = (text: string) =>
      `YouTube 视频：${title}\n来源：https://www.youtube.com/watch?v=${videoId}\n以下为视频字幕正文：\n${text}`
    // Match the page's Show transcript action before falling back to caption tracks.
    try {
      const initial = pageJson(html, 'ytInitialData')
      const params = findTranscriptParams(initial)
      const version = /"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"\n]+)"/.exec(html)?.[1]
      if (params && version) {
        const response = await client.post('https://www.youtube.com/youtubei/v1/get_transcript', {
          context: { client: { clientName: 'WEB', clientVersion: version, hl: 'en' } },
          params,
        })
        const text = transcriptResponseText(JSON.parse(response.data))
        if (text.length >= 80) return wrap(text)
      }
    } catch {
      /* Public transcript endpoint may be unavailable. */
    }
    // Some pages omit tracks; use the public player API as a second source.
    try {
      const key = /"INNERTUBE_API_KEY"\s*:\s*"([\w-]+)"/.exec(html)?.[1]
      if (key) {
        const response = await client.post(
          `https://www.youtube.com/youtubei/v1/player?key=${key}`,
          {
            context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
            videoId,
          }
        )
        const extra = JSON.parse(response.data)
        if (extra.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) player = extra
      }
    } catch {
      /* Keep tracks supplied by the original page. */
    }
    const renderer = player.captions?.playerCaptionsTracklistRenderer
    const tracks = renderer?.captionTracks || []
    const defaultIndex =
      renderer?.audioTracks?.[renderer.defaultAudioTrackIndex || 0]?.defaultCaptionTrackIndex
    const originalLanguage =
      tracks[defaultIndex]?.languageCode ||
      tracks.find((track: any) => track.kind === 'asr')?.languageCode
    const rank = (track: any) =>
      (originalLanguage && track.languageCode !== originalLanguage ? 10 : 0) +
      Number(track.kind === 'asr')
    // Prefer original human captions, then automatic captions; don't translate the source.
    const ordered = [...tracks].sort((a: any, b: any) => rank(a) - rank(b))
    for (const track of ordered
      .filter((track: any) => !originalLanguage || track.languageCode === originalLanguage)
      .slice(0, 3)) {
      try {
        const url = new URL(track.baseUrl)
        if (
          url.protocol !== 'https:' ||
          url.port ||
          !['www.youtube.com', 'youtube.com'].includes(url.hostname) ||
          url.pathname !== '/api/timedtext'
        )
          continue
        url.searchParams.set('fmt', 'json3')
        const { data } = await client.get(url.toString())
        const text = captionText(data, true)
        if (text.length < 80) continue
        return wrap(`字幕语言：${track.languageCode || '原语言'}\n${text}`)
      } catch {
        /* Try another available caption track. */
      }
    }
    throw new Error(failure)
  } catch {
    throw new Error(failure)
  }
}

export function findTranscriptParams(value: any): string | null {
  if (!value || typeof value !== 'object') return null
  if (typeof value.getTranscriptEndpoint?.params === 'string')
    return value.getTranscriptEndpoint.params
  for (const child of Object.values(value)) {
    const params = findTranscriptParams(child)
    if (params) return params
  }
  return null
}

export function transcriptResponseText(value: any): string {
  const lines: string[] = []
  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    const segment = node.transcriptSegmentRenderer
    if (segment) {
      const text =
        segment.snippet?.runs?.map((run: any) => run.text || '').join('') ||
        segment.snippet?.simpleText ||
        ''
      if (text.trim()) lines.push(timedLine(Number(segment.startMs) / 1000, text))
      return
    }
    for (const child of Object.values(node)) walk(child)
  }
  walk(value)
  return lines.join('\n')
}
