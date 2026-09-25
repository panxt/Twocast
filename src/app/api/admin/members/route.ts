import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { apiGrantsTable, sessionsTable, tasksTable, userApiSettingsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'

export async function PATCH(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const userId = Number(body?.userId)
  if (!Number.isInteger(userId) || userId < 1 || typeof body?.teamAccess !== 'boolean') {
    return NextResponse.json({ error: '成员参数无效' }, { status: 400 })
  }
  const [member] = await getDb().update(sessionsTable)
    .set({ teamAccess: body.teamAccess })
    .where(and(eq(sessionsTable.id, userId), eq(sessionsTable.role, 'member')))
    .returning({ id: sessionsTable.id, teamAccess: sessionsTable.teamAccess })
  if (!member) return NextResponse.json({ error: '成员不存在' }, { status: 404 })
  return NextResponse.json({ member })
}

export async function DELETE(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const userId = Number(request.nextUrl.searchParams.get('id'))
  if (!Number.isInteger(userId) || userId < 1) return NextResponse.json({ error: '成员 ID 无效' }, { status: 400 })
  const db = getDb()
  const [member] = await db.select({ id: sessionsTable.id }).from(sessionsTable)
    .where(and(eq(sessionsTable.id, userId), eq(sessionsTable.role, 'member'))).limit(1)
  if (!member) return NextResponse.json({ error: '成员不存在' }, { status: 404 })
  const [task] = await db.select({ id: tasksTable.id }).from(tasksTable).where(eq(tasksTable.userId, userId)).limit(1)
  if (task) {
    await db.update(sessionsTable).set({ expiresAt: new Date(), loginCodeHash: null })
      .where(eq(sessionsTable.id, userId))
    await db.delete(apiGrantsTable).where(eq(apiGrantsTable.userId, userId))
    return NextResponse.json({ ok: true, retainedForTasks: true })
  }
  await db.transaction(async tx => {
    await tx.delete(apiGrantsTable).where(eq(apiGrantsTable.userId, userId))
    await tx.delete(userApiSettingsTable).where(eq(userApiSettingsTable.userId, userId))
    await tx.delete(sessionsTable).where(eq(sessionsTable.id, userId))
  })
  return NextResponse.json({ ok: true, retainedForTasks: false })
}
