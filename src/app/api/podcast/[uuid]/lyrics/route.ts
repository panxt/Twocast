import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { getTaskByUuid } from '@/models/task'
import { taskGetStepItem } from '@/lib/podcast/task'
import { PodcastStep } from '@/lib/podcast/types'
import { LongTextResult } from '@/queue/types'
import { toLrc } from '@/lib/podcast/lyrics'
import { safeAudioBasename } from '@/lib/podcast/filename'
import { canReadTask } from '@/lib/podcast/access'

export async function GET(_: Request, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { uuid } = await context.params
  const task = await getTaskByUuid(uuid)
  if (!task || !canReadTask(task, user)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const audio = taskGetStepItem(task, PodcastStep.Audio)
  const timedScript = audio?.output?.timedScript
  if (!Array.isArray(timedScript)) return NextResponse.json({ error: '同步歌词尚未生成' }, { status: 404 })
  const title = (audio.input as LongTextResult)?.title || '驿·声笺'
  return new Response(toLrc(timedScript, title), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': `attachment; filename="podcast.lrc"; filename*=UTF-8''${encodeURIComponent(safeAudioBasename(title) + '.lrc')}`,
      'cache-control': 'private, no-store',
    },
  })
}
