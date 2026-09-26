import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { tasksTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { getTaskByUuid } from '@/models/task'
import { canManageTask, canReadTask } from '@/lib/podcast/access'
import { getCoverUrl, removeCover } from '@/lib/podcast/storage'
import { COVER_MAX_BYTES, COVER_TYPES, replaceCover, sniffImageType } from '@/lib/podcast/cover'
import { coverUrlFor } from '@/lib/podcast/cover-url'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const task = await getTaskByUuid((await context.params).uuid)
  if (!task || !canReadTask(task, user)) return NextResponse.json({ error: '封面不存在' }, { status: 404 })
  if (!task.coverLocation) return NextResponse.json({ error: '这期节目还没有封面' }, { status: 404 })
  const url = await getCoverUrl(task.coverLocation)
  return NextResponse.redirect(new URL(url, request.url), { headers: { 'cache-control': 'private, max-age=3600' } })
}

// 上传封面：multipart 里一个 file 字段，PNG / JPEG / WebP，3 MB 以内。
export async function POST(request: NextRequest, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const task = await getTaskByUuid((await context.params).uuid)
  if (!task || !canManageTask(task, user)) return NextResponse.json({ error: '节目不存在' }, { status: 404 })
  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '请选择一张图片' }, { status: 400 })
  if (file.size < 1 || file.size > COVER_MAX_BYTES) return NextResponse.json({ error: '图片须在 3 MB 以内' }, { status: 400 })
  const bytes = Buffer.from(await file.arrayBuffer())
  const mimeType = sniffImageType(bytes)
  if (!mimeType) return NextResponse.json({ error: '只支持 PNG、JPEG、WebP' }, { status: 400 })
  const location = await replaceCover(task, bytes, mimeType, COVER_TYPES[mimeType])
  return NextResponse.json({ ok: true, coverUrl: coverUrlFor(task.uuid, location) })
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const task = await getTaskByUuid((await context.params).uuid)
  if (!task || !canManageTask(task, user)) return NextResponse.json({ error: '节目不存在' }, { status: 404 })
  if (task.coverLocation) {
    await removeCover(task.coverLocation).catch(() => undefined)
    await getDb().update(tasksTable).set({ coverLocation: null, updatedAt: new Date() }).where(eq(tasksTable.id, task.id))
  }
  return NextResponse.json({ ok: true })
}
