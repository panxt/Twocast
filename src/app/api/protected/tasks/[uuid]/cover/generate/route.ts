import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { getTaskByUuid } from '@/models/task'
import { canManageTask } from '@/lib/podcast/access'
import { generateCover, type CoverProvider } from '@/lib/podcast/cover'
import { coverUrlFor } from '@/lib/podcast/cover-url'
import { TaskStatus } from '@/types/task'

export const runtime = 'nodejs'
export const maxDuration = 60

// AI 生成封面：默认调用现有 MiniMax API，也可明确选用 Gemini。
export async function POST(request: NextRequest, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const task = await getTaskByUuid((await context.params).uuid)
  if (!task || !canManageTask(task, user)) return NextResponse.json({ error: '节目不存在' }, { status: 404 })
  if (task.status !== TaskStatus.Success) return NextResponse.json({ error: '节目生成完成后才能生成封面' }, { status: 409 })
  const body = await request.json().catch(() => ({}))
  const hint = typeof body?.hint === 'string' ? body.hint.trim().slice(0, 200) : undefined
  const provider = body?.provider ?? 'minimax'
  if (provider !== 'minimax' && provider !== 'gemini') {
    return NextResponse.json({ error: '不支持的封面图片服务' }, { status: 400 })
  }
  try {
    const location = await generateCover(user, task, hint || undefined, provider as CoverProvider)
    return NextResponse.json({ ok: true, coverUrl: coverUrlFor(task.uuid, location) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '封面生成失败' }, { status: 502 })
  }
}
