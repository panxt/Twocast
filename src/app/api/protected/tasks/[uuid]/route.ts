import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { tasksTable, teamsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { TaskStatus } from '@/types/task'
import { isValidFolderPath } from '@/lib/podcast/folder'
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
  await getDb()
    .update(tasksTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tasksTable.id, task.id), eq(tasksTable.status, task.status)))
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
  const sharedTeamIds = body?.sharedTeamIds ?? (visibility === 'team' ? task.sharedTeamIds : [])
  if (
    !Array.isArray(sharedTeamIds) ||
    sharedTeamIds.length > 30 ||
    sharedTeamIds.some(
      (id) => !Number.isInteger(id) || id < 1 || (!user.isAdmin && !user.teamIds.includes(id))
    )
  )
    return NextResponse.json({ error: '请选择自己所属的团队' }, { status: 400 })
  if (visibility === 'team' && !sharedTeamIds.length)
    return NextResponse.json({ error: '请选择至少一个共享团队' }, { status: 400 })
  if (sharedTeamIds.length) {
    const valid = await getDb()
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(and(inArray(teamsTable.id, sharedTeamIds), eq(teamsTable.active, true)))
    if (valid.length !== new Set(sharedTeamIds).size)
      return NextResponse.json({ error: '团队不存在或已停用' }, { status: 400 })
  }
  if (visibility !== 'private' && visibility !== 'team') {
    return NextResponse.json({ error: '共享范围无效' }, { status: 400 })
  }
  if (visibility === 'team' && task.status !== TaskStatus.Success) {
    return NextResponse.json({ error: '节目完成后才能共享给团队' }, { status: 409 })
  }
  if (!isValidFolderPath(folderPath)) {
    return NextResponse.json({ error: '目录格式须为 /目录/子目录/' }, { status: 400 })
  }
  if (
    !Array.isArray(labels) ||
    labels.length > 8 ||
    labels.some((label) => typeof label !== 'string' || !label.trim() || label.length > 24)
  ) {
    return NextResponse.json({ error: '最多设置 8 个标签，每个不超过 24 字' }, { status: 400 })
  }
  await getDb()
    .update(tasksTable)
    .set({
      folderPath,
      labels,
      visibility,
      sharedTeamIds: visibility === 'team' ? [...new Set(sharedTeamIds)] : [],
      updatedAt: new Date(),
    })
    .where(eq(tasksTable.id, task.id))
  return NextResponse.json({ ok: true })
}
