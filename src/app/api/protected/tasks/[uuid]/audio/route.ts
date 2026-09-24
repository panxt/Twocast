import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { getTaskByUuid } from '@/models/task'
import { canReadTask } from '@/lib/podcast/access'
import { taskGetStepItem } from '@/lib/podcast/task'
import { PodcastStep, type AudioOutput } from '@/lib/podcast/types'
import { getAudioUrl } from '@/lib/podcast/storage'

export async function GET(request: Request, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const task = await getTaskByUuid((await context.params).uuid)
  if (!task || !canReadTask(task, user)) return NextResponse.json({ error: '音频不存在' }, { status: 404 })
  const audio = taskGetStepItem(task, PodcastStep.Audio).output as AudioOutput | undefined
  if (!audio?.location) return NextResponse.json({ error: '音频尚未生成' }, { status: 404 })
  const url = await getAudioUrl(audio.location)
  return NextResponse.redirect(new URL(url, request.url), { headers: { 'cache-control': 'private, no-store' } })
}
