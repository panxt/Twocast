import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import {
  apiGrantsTable,
  deviceSessionsTable,
  sessionsTable,
  tasksTable,
  userApiSettingsTable,
  teamsTable,
  teamMembersTable,
  memberApiSharesTable,
} from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { canManageAccount } from '@/lib/account-permissions'

export async function GET() {
  const user = await getCurrentUser()
  if (!user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const accounts = await getDb()
    .select({
      id: sessionsTable.id,
      role: sessionsTable.role,
      displayName: sessionsTable.displayName,
      disabled: sessionsTable.disabled,
      expiresAt: sessionsTable.expiresAt,
    })
    .from(sessionsTable)
  return NextResponse.json(
    { accounts, isSuperAdmin: user.isSuperAdmin, viewerId: user.userId },
    { headers: { 'cache-control': 'no-store' } }
  )
}
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const userId = Number(body?.userId)
  if (
    !Number.isInteger(userId) ||
    userId < 1 ||
    !body ||
    (body.role !== undefined && !['member', 'admin'].includes(body.role)) ||
    (body.disabled !== undefined && typeof body.disabled !== 'boolean') ||
    (body.displayName !== undefined &&
      (typeof body.displayName !== 'string' || body.displayName.length > 80)) ||
    (body.teamAccess !== undefined && typeof body.teamAccess !== 'boolean')
  )
    return NextResponse.json({ error: '账号参数无效' }, { status: 400 })
  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, userId))
      .for('update')
    if (!target) return NextResponse.json({ error: '账号不存在' }, { status: 404 })
    if (!canManageAccount(user, target) || (body.role !== undefined && !user.isSuperAdmin))
      return NextResponse.json({ error: '没有修改此账号或角色的权限' }, { status: 403 })
    if (
      target.role === 'super_admin' &&
      (body.role !== undefined || body.disabled !== undefined || body.teamAccess !== undefined)
    )
      return NextResponse.json({ error: '超级管理员身份不能降权或停用' }, { status: 403 })
    const change: Partial<typeof sessionsTable.$inferInsert> = {}
    if (body.role !== undefined) change.role = body.role
    if (body.displayName !== undefined) change.displayName = body.displayName.trim()
    if (body.teamAccess !== undefined) change.teamAccess = body.teamAccess
    if (body.disabled !== undefined) {
      change.disabled = body.disabled
      if (body.disabled) {
        change.expiresAt = new Date()
        change.loginCodeHash = null
        await tx.delete(deviceSessionsTable).where(eq(deviceSessionsTable.userId, userId))
      }
    }
    if (!Object.keys(change).length)
      return NextResponse.json({ error: '请选择要修改的内容' }, { status: 400 })
    await tx.update(sessionsTable).set(change).where(eq(sessionsTable.id, userId))
    if (body.teamAccess !== undefined) {
      const [legacy] = await tx
        .select()
        .from(teamsTable)
        .where(eq(teamsTable.name, '原有团队'))
        .limit(1)
      if (legacy) {
        if (body.teamAccess)
          await tx
            .insert(teamMembersTable)
            .values({ userId, teamId: legacy.id })
            .onConflictDoNothing()
        else
          await tx
            .delete(teamMembersTable)
            .where(and(eq(teamMembersTable.userId, userId), eq(teamMembersTable.teamId, legacy.id)))
      }
    }
    return NextResponse.json({ ok: true })
  })
}
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const userId = Number(request.nextUrl.searchParams.get('id'))
  if (!Number.isInteger(userId) || userId < 1)
    return NextResponse.json({ error: '账号 ID 无效' }, { status: 400 })
  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, userId))
      .for('update')
    if (!target) return NextResponse.json({ error: '账号不存在' }, { status: 404 })
    if (!canManageAccount(user, target) || target.role === 'super_admin' || user.userId === userId)
      return NextResponse.json({ error: '不能删除此账号' }, { status: 403 })
    const [task] = await tx
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.userId, userId))
      .limit(1)
    await tx.delete(deviceSessionsTable).where(eq(deviceSessionsTable.userId, userId))
    await tx
      .update(memberApiSharesTable)
      .set({ active: false })
      .where(eq(memberApiSharesTable.ownerUserId, userId))
    await tx.delete(apiGrantsTable).where(eq(apiGrantsTable.userId, userId))
    if (task)
      await tx
        .update(sessionsTable)
        .set({ disabled: true, expiresAt: new Date(), loginCodeHash: null })
        .where(eq(sessionsTable.id, userId))
    else {
      await tx.delete(userApiSettingsTable).where(eq(userApiSettingsTable.userId, userId))
      await tx.delete(sessionsTable).where(eq(sessionsTable.id, userId))
    }
    return NextResponse.json({ ok: true, retainedForTasks: Boolean(task) })
  })
}
