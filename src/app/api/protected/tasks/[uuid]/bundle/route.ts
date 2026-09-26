import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { getTaskByUuid } from '@/models/task'
import { canReadTask } from '@/lib/podcast/access'
import { taskGetStepItem } from '@/lib/podcast/task'
import { PodcastStep, type AudioOutput } from '@/lib/podcast/types'
import { readAudio } from '@/lib/podcast/storage'
import { safeAudioBasename } from '@/lib/podcast/filename'
import { toLrc } from '@/lib/podcast/lyrics'
import { buildStoredZip } from '@/lib/zip'
import { LongTextResult } from '@/queue/types'

export const runtime = 'nodejs'

// 一次下载 MP3 与同名 .lrc：网易云等桌面播放器对本地歌曲只认"同目录、同文件名"的歌词文件，
// 分开下载时用户很容易改名或放错目录，打包后解压即用。
export async function GET(_: Request, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const task = await getTaskByUuid((await context.params).uuid)
  if (!task || !canReadTask(task, user)) return NextResponse.json({ error: '音频不存在' }, { status: 404 })
  const audioStep = taskGetStepItem(task, PodcastStep.Audio)
  const audio = audioStep.output as AudioOutput | undefined
  if (!audio?.location) return NextResponse.json({ error: '音频尚未生成' }, { status: 404 })
  if (!Array.isArray(audio.timedScript) || !audio.timedScript.length) {
    return NextResponse.json({ error: '这期节目还没有同步字幕，请直接下载 MP3' }, { status: 404 })
  }
  if (!audio.location.startsWith('supabase:')) {
    return NextResponse.json({ error: '本地存储的音频不支持打包下载' }, { status: 400 })
  }
  const title = (audioStep.input as LongTextResult | undefined)?.title || '播客'
  const basename = safeAudioBasename(title)
  const mp3 = await readAudio(audio.location.slice('supabase:'.length))
  const zip = buildStoredZip([
    { name: `${basename}.mp3`, data: mp3 },
    { name: `${basename}.lrc`, data: Buffer.from(toLrc(audio.timedScript, title), 'utf8') },
  ])
  return new Response(new Uint8Array(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-length': String(zip.length),
      'content-disposition': `attachment; filename="podcast.zip"; filename*=UTF-8''${encodeURIComponent(basename + '.zip')}`,
      'cache-control': 'private, no-store',
    },
  })
}
