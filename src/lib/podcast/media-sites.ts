import { load } from 'cheerio'
import { mediaClient, timedLine } from './media-client'

const audioHosts = new Set([
  'www.xiaoyuzhoufm.com',
  'xiaoyuzhoufm.com',
  'podcasts.apple.com',
  'open.spotify.com',
  'www.ximalaya.com',
  'www.lizhi.fm',
  'soundcloud.com',
  'www.soundcloud.com',
])
const otherVideoHosts = new Set([
  'www.douyin.com',
  'v.douyin.com',
  'www.kuaishou.com',
  'v.youku.com',
  'v.qq.com',
  'www.iqiyi.com',
])

export function mediaSite(input: string): 'vimeo' | 'audio' | 'restricted-video' | null {
  const host = new URL(input).hostname
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) return 'vimeo'
  if (audioHosts.has(host)) return 'audio'
  if (otherVideoHosts.has(host)) return 'restricted-video'
  return null
}

export function vttText(raw: string): string {
  const lines: string[] = []
  for (const block of raw.replace(/\r/g, '').split(/\n\s*\n/)) {
    const match = /(?:(\d+):)?(\d{2}):(\d{2})[.,]\d+\s+-->[^\n]*\n([\s\S]+)/.exec(block)
    if (!match) continue
    const seconds = Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3])
    const text = load(`<body>${match[4]}</body>`).text().trim()
    if (text) lines.push(timedLine(seconds, text))
  }
  return lines.join('\n')
}

export async function extractVimeoTranscript(input: string): Promise<string> {
  const url = new URL(input)
  const id = /\/(?:video\/)?(\d+)(?:\/|$)/.exec(url.pathname)?.[1]
  if (!id) throw new Error('请填写 Vimeo 单个公开视频链接。')
  try {
    const client = mediaClient()
    const config = JSON.parse(
      (await client.get(`https://player.vimeo.com/video/${id}/config`)).data
    )
    for (const track of (config.request?.text_tracks || []).slice(0, 3)) {
      const source = new URL(track.url, 'https://player.vimeo.com')
      if (
        source.protocol !== 'https:' ||
        source.port ||
        !(
          ['player.vimeo.com', 'vimeo.com'].includes(source.hostname) ||
          source.hostname.endsWith('.vimeocdn.com')
        )
      )
        continue
      const text = vttText((await client.get(source.toString())).data)
      if (text.length >= 80)
        return `Vimeo 视频：${config.video?.title || id}\n来源：https://vimeo.com/${id}\n以下为公开字幕正文：\n${text}`
    }
  } catch {
    /* Private videos and absent tracks are not transcript content. */
  }
  throw new Error(
    '无法取得 Vimeo 公开字幕。请复制文字稿到「长文本」，或上传 TXT / Markdown 后重试。'
  )
}

export function podcastPageTranscript(html: string): string {
  const $ = load(html)
  // Only explicit transcript data counts, never descriptions/show notes or comments.
  const texts: string[] = []
  function walk(node: any) {
    if (!node || typeof node !== 'object') return
    if (typeof node.transcript === 'string') texts.push(node.transcript)
    for (const child of Object.values(node)) if (typeof child === 'object') walk(child)
  }
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      walk(JSON.parse($(element).text()))
    } catch {
      /* Ignore malformed structured data. */
    }
  })
  $('[itemprop="transcript"]').each((_, element) => {
    texts.push($(element).text())
  })
  return texts
    .map((text) => load(`<body>${text}</body>`).text().trim())
    .filter(Boolean)
    .join('\n')
}

export async function extractAudioPageTranscript(input: string): Promise<string> {
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.port) throw new Error('Invalid media URL')
    const html = (await mediaClient().get(input)).data
    const text = podcastPageTranscript(html)
    if (text.length >= 80) return `音频来源：${input}\n以下为页面公开文字稿：\n${text}`
  } catch {
    /* Require an actual transcript. */
  }
  throw new Error(
    '该音频页面没有可读取的公开文字稿，或站点限制访问。简介不等于音频正文；请粘贴文字稿或上传 TXT / Markdown。目前不会自动下载并转录原音频。'
  )
}
