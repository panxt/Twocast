import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { youtubeVideoId, extractYoutubeTranscript } from '@/lib/podcast/youtube'
import { isBilibiliUrl, extractBilibiliTranscript } from '@/lib/podcast/bilibili'
import {
  mediaSite,
  extractVimeoTranscript,
  extractAudioPageTranscript,
} from '@/lib/podcast/media-sites'
import { INPUT_MAX_CHARACTERS } from '@/lib/podcast/limits'

export const runtime = 'nodejs'
export const maxDuration = 180
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url || url.length > 2048)
    return NextResponse.json({ error: '请填写单个视频或音频链接' }, { status: 400 })
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password)
      throw new Error('请使用 HTTPS 视频或音频链接')
    const id = youtubeVideoId(url)
    const site = mediaSite(url)
    let text: string
    if (id) text = await extractYoutubeTranscript(id)
    else if (isBilibiliUrl(url)) text = await extractBilibiliTranscript(url)
    else if (site === 'vimeo') text = await extractVimeoTranscript(url)
    else if (site === 'audio') text = await extractAudioPageTranscript(url)
    else throw new Error('该站点暂不支持完整文字稿预览；普通文章可直接创建播客。视频请粘贴文字稿。')
    if (text.length > INPUT_MAX_CHARACTERS)
      throw new Error('文字稿超过 10 万字符，请分段粘贴生成。')
    return NextResponse.json(
      { text, characters: text.length },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '文字稿提取失败，请稍后重试' },
      { status: 422 }
    )
  }
}
