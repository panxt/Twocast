import { randomBytes } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { inviteCodesTable, inviteTeamsTable, teamsTable } from '@/db/schema'
import { getCurrentUser, sha256 } from '@/utils/user'
export async function GET() {
  const viewer = await getCurrentUser()
  if (!viewer.isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const db = getDb()
  const [codes, assignments] = await Promise.all([
    db
      .select({
        id: inviteCodesTable.id,
        accountRole: inviteCodesTable.accountRole,
        label: inviteCodesTable.label,
        initialDisplayName: inviteCodesTable.initialDisplayName,
        maxUses: inviteCodesTable.maxUses,
        usedCount: inviteCodesTable.usedCount,
        expiresAt: inviteCodesTable.expiresAt,
      })
      .from(inviteCodesTable)
      .where(viewer.isSuperAdmin ? undefined : eq(inviteCodesTable.accountRole, 'member')),
    db.select().from(inviteTeamsTable),
  ])
  return Response.json({ codes, assignments })
}
export async function POST(req: Request) {
  return save(req, false)
}
export async function PATCH(req: Request) {
  return save(req, true)
}
async function save(req: Request, update: boolean) {
  const viewer = await getCurrentUser()
  if (!viewer.isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => null)
  if (
    !b ||
    typeof b.label !== 'string' ||
    b.label.length > 120 ||
    (b.initialDisplayName !== undefined &&
      (typeof b.initialDisplayName !== 'string' || b.initialDisplayName.trim().length > 40)) ||
    !Number.isInteger(b.maxUses) ||
    b.maxUses < 1 ||
    b.maxUses > 10000 ||
    !Array.isArray(b.teamIds) ||
    b.teamIds.length > 30 ||
    b.teamIds.some((id) => !Number.isInteger(id) || id < 1) ||
    (update && (!Number.isInteger(b.id) || typeof b.active !== 'boolean'))
  )
    return Response.json({ error: '邀请码参数无效' }, { status: 400 })
  const role = b.accountRole ?? 'member'
  const initialDisplayName = b.initialDisplayName?.trim() || null
  if (initialDisplayName && b.maxUses !== 1)
    return Response.json(
      { error: '指定姓名的邀请码仅可兑换一次，请为每个人分别创建' },
      { status: 400 }
    )
  if (!['member', 'admin'].includes(role) || (role === 'admin' && !viewer.isSuperAdmin))
    return Response.json({ error: '仅超级管理员可创建管理员内测码' }, { status: 403 })
  const ids = [...new Set<number>(b.teamIds)]
  const db = getDb()
  if (
    ids.length &&
    (
      await db
        .select()
        .from(teamsTable)
        .where(and(inArray(teamsTable.id, ids), eq(teamsTable.active, true)))
    ).length !== ids.length
  )
    return Response.json({ error: '团队不存在或已停用' }, { status: 400 })
  const code = randomBytes(18).toString('base64url').toUpperCase()
  try {
    await db.transaction(async (tx) => {
      let id = b.id
      if (update) {
        const [current] = await tx
          .select()
          .from(inviteCodesTable)
          .where(eq(inviteCodesTable.id, id))
          .for('update')
        if (current?.accountRole === 'admin' && !viewer.isSuperAdmin)
          throw new Error('无权管理管理员内测码')
        if (current && current.usedCount > 0 && current.accountRole !== role)
          throw new Error('已兑换的邀请码不能改变账号角色，请在账号管理中调整')
        if (!current || current.usedCount > b.maxUses)
          throw new Error('邀请码不存在，或上限低于已兑换人数')
        const name =
          b.initialDisplayName === undefined ? current.initialDisplayName : initialDisplayName
        if (name && b.maxUses !== 1) throw new Error('指定姓名的邀请码仅可兑换一次')
        await tx
          .update(inviteCodesTable)
          .set({
            accountRole: role,
            label: b.label,
            initialDisplayName: name,
            maxUses: b.maxUses,
            teamAccess: ids.length > 0,
            expiresAt: b.active ? null : new Date(),
          })
          .where(eq(inviteCodesTable.id, id))
        await tx.delete(inviteTeamsTable).where(eq(inviteTeamsTable.inviteCodeId, id))
      } else {
        const [created] = await tx
          .insert(inviteCodesTable)
          .values({
            accountRole: role,
            label: b.label,
            initialDisplayName,
            maxUses: b.maxUses,
            teamAccess: ids.length > 0,
            codeHash: sha256(code),
          })
          .returning({ id: inviteCodesTable.id })
        id = created.id
      }
      if (ids.length)
        await tx
          .insert(inviteTeamsTable)
          .values(ids.map((teamId) => ({ inviteCodeId: id, teamId })))
    })
    return Response.json(update ? { ok: true } : { code })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '操作失败' }, { status: 400 })
  }
}
