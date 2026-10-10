import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { getTaskByUuid } from '@/models/task'
import { canReadTask } from '@/lib/podcast/access'
import { sourceTextFor } from '@/lib/podcast/source-text'

export async function GET(request: Request, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const task = await getTaskByUuid((await context.params).uuid)
  if (!task || !canReadTask(task, user))
    return NextResponse.json({ error: '文字稿不存在' }, { status: 404 })
  const text = sourceTextFor(task)
  if (!text) return NextResponse.json({ error: '这期没有保存来源文字稿' }, { status: 404 })
  const download = new URL(request.url).searchParams.get('download') === '1'
  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="source-transcript.txt"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
