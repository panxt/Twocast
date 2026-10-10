import { mediaClient, timedLine } from './media-client'

const hosts = new Set(['www.bilibili.com', 'bilibili.com', 'm.bilibili.com', 'b23.tv'])
export function isBilibiliUrl(input: string) {
  return hosts.has(new URL(input).hostname)
}
const failure =
  '无法取得 B 站完整字幕：视频没有公开字幕、需要登录或站点限制访问。请复制字幕到「长文本」，或上传 TXT / Markdown；弹幕、标题和简介不会作为完整字幕生成播客。'

export async function extractBilibiliTranscript(input: string): Promise<string> {
  const client = mediaClient()
  try {
    let url = new URL(input)
    if (url.protocol !== 'https:' || url.port) throw new Error(failure)
    if (url.hostname === 'b23.tv') {
      const response = await client.get(url.toString(), {
        validateStatus: (status) => status >= 300 && status < 400,
      })
      url = new URL(response.headers.location, url)
      if (
        !['www.bilibili.com', 'bilibili.com', 'm.bilibili.com'].includes(url.hostname) ||
        url.protocol !== 'https:'
      )
        throw new Error(failure)
    }
    const id = /\/video\/(BV[\w]{10}|av\d+)/i.exec(url.pathname)?.[1]
    if (!id) throw new Error('请填写 B 站单个视频链接，不支持频道、番剧或直播链接。')
    const params = /^av/i.test(id) ? { aid: id.slice(2) } : { bvid: id }
    const view = JSON.parse(
      (await client.get('https://api.bilibili.com/x/web-interface/view', { params })).data
    )
    if (view.code !== 0) throw new Error(failure)
    const page = Number(url.searchParams.get('p') || '1')
    const cid = view.data.pages?.find((part: any) => part.page === page)?.cid
    if (!cid) throw new Error(failure)
    const player = JSON.parse(
      (
        await client.get('https://api.bilibili.com/x/player/v2', {
          params: { aid: view.data.aid, cid },
          headers: { Referer: 'https://www.bilibili.com/' },
        })
      ).data
    )
    if (player.code !== 0) throw new Error(failure)
    const tracks = player.data?.subtitle?.subtitles || []
    for (const track of tracks.slice(0, 3)) {
      try {
        const subtitle = new URL(track.subtitle_url, 'https://www.bilibili.com')
        if (
          subtitle.protocol !== 'https:' ||
          subtitle.port ||
          !(subtitle.hostname === 'hdslb.com' || subtitle.hostname.endsWith('.hdslb.com'))
        )
          continue
        const data = JSON.parse((await client.get(subtitle.toString())).data)
        const text = (data.body || [])
          .filter((line: any) => typeof line.content === 'string')
          .map((line: any) => timedLine(Number(line.from), line.content))
          .join('\n')
        if (text.length >= 80)
          return `B 站视频：${view.data.title}\n来源：https://www.bilibili.com/video/${view.data.bvid}?p=${page}\n以下为第 ${page} 分 P 的字幕正文：\n${text}`
      } catch {
        /* Try another public subtitle track. */
      }
    }
    throw new Error(failure)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('请填写')) throw error
    throw new Error(failure)
  }
}
