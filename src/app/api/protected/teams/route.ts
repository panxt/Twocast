import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { teamsTable, teamMembersTable, sessionsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'

export async function GET() {
  const user = await getCurrentUser()
  if (!user.userEmail) return Response.json({ error: '请先登录' }, { status: 401 })
  const db = getDb()
  const teams = await db
    .select()
    .from(teamsTable)
    .where(
      user.isAdmin ? undefined : inArray(teamsTable.id, user.teamIds.length ? user.teamIds : [-1])
    )
  const members = teams.length
    ? await db
        .select({
          teamId: teamMembersTable.teamId,
          userId: teamMembersTable.userId,
          role: teamMembersTable.role,
          displayName: sessionsTable.displayName,
        })
        .from(teamMembersTable)
        .innerJoin(sessionsTable, eq(sessionsTable.id, teamMembersTable.userId))
        .where(
          inArray(
            teamMembersTable.teamId,
            teams.map((t) => t.id)
          )
        )
    : []
  const users = user.isAdmin
    ? await db
        .select({ id: sessionsTable.id, displayName: sessionsTable.displayName, role: sessionsTable.role })
        .from(sessionsTable)
    : []
  return Response.json(
    { teams, members, users, isAdmin: user.isAdmin, isSuperAdmin: user.isSuperAdmin, teamAdminIds: user.teamAdminIds },
    { headers: { 'cache-control': 'no-store' } }
  )
}
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user.isAdmin) return Response.json({ error: '仅平台管理员可创建团队' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (typeof body?.name !== 'string' || !body.name.trim() || body.name.length > 80)
    return Response.json({ error: '请输入 1–80 字的团队名称' }, { status: 400 })
  const [team] = await getDb().insert(teamsTable).values({ name: body.name.trim() }).returning()
  return Response.json({ team })
}
export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  const body = await request.json().catch(() => null)
  const teamId = Number(body?.teamId)
  if (
    !Number.isInteger(teamId) ||
    teamId < 1 ||
    (!user.isAdmin && !user.teamAdminIds.includes(teamId))
  )
    return Response.json({ error: '没有此团队的管理权限' }, { status: 403 })
  const db = getDb()
  if (body.userId !== undefined) {
    const userId = Number(body.userId)
    if (
      !Number.isInteger(userId) ||
      userId < 1 ||
      !['member', 'admin', 'remove'].includes(body.role)
    )
      return Response.json({ error: '成员参数无效' }, { status: 400 })
    // Team admins may change existing members only; cross-team assignments require a platform admin.
    const [existing] = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)))
    if (!user.isAdmin && !existing)
      return Response.json(
        { error: '新增成员请联系平台管理员或通过团队邀请码加入' },
        { status: 403 }
      )
    const [account] = await db
      .select({ id: sessionsTable.id, role: sessionsTable.role })
      .from(sessionsTable)
      .where(eq(sessionsTable.id, userId))
    if (account?.role === 'super_admin' && !user.isSuperAdmin) return Response.json({ error: '不能修改超级管理员的团队权限' }, { status: 403 })
    if (!account) return Response.json({ error: '成员不存在' }, { status: 404 })
    if (body.role === 'remove')
      await db
        .delete(teamMembersTable)
        .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)))
    else
      await db
        .insert(teamMembersTable)
        .values({ teamId, userId, role: body.role })
        .onConflictDoUpdate({
          target: [teamMembersTable.teamId, teamMembersTable.userId],
          set: { role: body.role },
        })
  } else {
    if (
      !user.isAdmin ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 80 ||
      typeof body.active !== 'boolean'
    )
      return Response.json({ error: '团队参数无效' }, { status: 400 })
    await db
      .update(teamsTable)
      .set({ name: body.name.trim(), active: body.active })
      .where(eq(teamsTable.id, teamId))
  }
  return Response.json({ ok: true })
}
