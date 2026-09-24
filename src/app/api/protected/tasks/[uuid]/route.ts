import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { tasksTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { TaskStatus } from '@/types/task'
import { PodcastStep, TaskUserInput } from '@/lib/podcast/types'
import { taskGetStepItem } from '@/lib/podcast/task'
import { removeAudio, removeUpload } from '@/lib/podcast/storage'
import { canManageTask } from '@/lib/podcast/access'

export async function DELETE(_: NextRequest, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const { uuid } = await context.params
  const [task] = await getDb().select().from(tasksTable).where(eq(tasksTable.uuid, uuid)).limit(1)
  if (!task || !canManageTask(task, user)) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 })
  }
  if (task.status === TaskStatus.Pending || task.status === TaskStatus.Processing) {
    return NextResponse.json({ error: '生成中的任务暂不能删除，请等待完成' }, { status: 409 })
  }
  const audioOutput = taskGetStepItem(task, PodcastStep.Audio)?.output
  const audioFiles = [audioOutput?.location, audioOutput?.backupLocation]
    .filter((location): location is string => typeof location === 'string' && location.startsWith('supabase:'))
    .map(location => location.slice('supabase:'.length))
  if (audioFiles.length) await removeAudio(audioFiles)
  const upload = (task.userInputs as TaskUserInput)?.fileLocation
  if (upload) await removeUpload(upload)
  await getDb().delete(tasksTable).where(and(eq(tasksTable.id, task.id), eq(tasksTable.status, task.status)))
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ uuid: string }> }) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const { uuid } = await context.params
  const [task] = await getDb().select().from(tasksTable).where(eq(tasksTable.uuid, uuid)).limit(1)
  if (!task || !canManageTask(task, user)) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 })
  }
  const body = await request.json().catch(() => null)
  const folderPath = body?.folderPath ?? task.folderPath
  const labels = body?.labels ?? task.labels
  const visibility = body?.visibility ?? task.visibility
  if (visibility !== 'private' && visibility !== 'team') {
    return NextResponse.json({ error: '共享范围无效' }, { status: 400 })
  }
  if (visibility === 'team' && task.status !== TaskStatus.Success) {
    return NextResponse.json({ error: '节目完成后才能共享给团队' }, { status: 409 })
  }
  if (typeof folderPath !== 'string' || !folderPath.startsWith('/') || !folderPath.endsWith('/') ||
      folderPath.length > 255 || folderPath.includes('\\') ||
      folderPath.split('/').some((segment, index) => index > 0 && index < folderPath.split('/').length - 1 &&
        (!segment || segment.length > 40 || [...segment].some(character => character.charCodeAt(0) < 32)))) {
    return NextResponse.json({ error: '目录格式须为 /目录/子目录/' }, { status: 400 })
  }
  if (!Array.isArray(labels) || labels.length > 8 || labels.some(label => typeof label !== 'string' || !label.trim() || label.length > 24)) {
    return NextResponse.json({ error: '最多设置 8 个标签，每个不超过 24 字' }, { status: 400 })
  }
  await getDb().update(tasksTable).set({ folderPath, labels, visibility, updatedAt: new Date() }).where(eq(tasksTable.id, task.id))
  return NextResponse.json({ ok: true })
}
