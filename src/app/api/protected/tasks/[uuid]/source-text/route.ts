import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { getTaskByUuid } from '@/models/task'
import { canReadTask } from '@/lib/podcast/access'
import { safeAudioBasename } from '@/lib/podcast/filename'
import { sourceTextFor } from '@/lib/podcast/source-text'

export async function GET(request: Request, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const task = await getTaskByUuid((await context.params).uuid)
  if (!task || !canReadTask(task, user))
    return NextResponse.json({ error: '文字稿不存在' }, { status: 404 })
  const text = sourceTextFor(task)
  if (!text) return NextResponse.json({ error: '这期没有保存来源文字稿' }, { status: 404 })
  const steps = task.stepsDetail as Record<
    string,
    { input?: { title?: unknown }; output?: { title?: unknown } }
  > | null
  const title =
    steps?.audio?.input?.title ||
    steps?.['long-text']?.output?.title ||
    text.match(/^(?:公众号文章：|YouTube 视频：|B 站视频：)([^\r\n]+)/)?.[1] ||
    '播客'
  const filename = `${safeAudioBasename(typeof title === 'string' ? title : '播客')}-源文字稿.txt`
  const download = new URL(request.url).searchParams.get('download') === '1'
  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="transcript.txt"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g, '%27')}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
