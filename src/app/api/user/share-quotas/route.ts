import { eq, or } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { apiGrantsTable, memberApiSharesTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
export async function GET() {
  const user = await getCurrentUser()
  if (!user.userEmail) return Response.json({ error: '请先登录' }, { status: 401 })
  const db = getDb()
  const shares = await db
    .select()
    .from(memberApiSharesTable)
    .where(
      user.isSuperAdmin
        ? undefined
        : or(
            eq(memberApiSharesTable.ownerUserId, user.userId),
            eq(memberApiSharesTable.recipientUserId, user.userId),
            eq(memberApiSharesTable.delegatedByUserId, user.userId)
          )
    )
  const grants = user.isSuperAdmin ? await db.select().from(apiGrantsTable) : []
  return Response.json({ shares, grants, userId: user.userId, isAdmin: user.isSuperAdmin })
}
export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  const b = await req.json().catch(() => null)
  if (
    !b ||
    !Number.isInteger(b.id) ||
    b.id < 1 ||
    !['share', 'grant'].includes(b.kind) ||
    (b.dailyLimit !== null &&
      (!Number.isInteger(b.dailyLimit) || b.dailyLimit < 0 || b.dailyLimit > 10000))
  )
    return Response.json({ error: '每日额度无效；留空不限，0 暂停' }, { status: 400 })
  const db = getDb()
  if (b.kind === 'grant') {
    if (!user.isSuperAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })
    await db
      .update(apiGrantsTable)
      .set({ dailyLimit: b.dailyLimit })
      .where(eq(apiGrantsTable.id, b.id))
  } else {
    const [share] = await db
      .select()
      .from(memberApiSharesTable)
      .where(eq(memberApiSharesTable.id, b.id))
    if (!share || (!user.isSuperAdmin && share.ownerUserId !== user.userId))
      return Response.json({ error: '仅原 Key 持有人可调整每日额度' }, { status: 403 })
    await db
      .update(memberApiSharesTable)
      .set({ dailyLimit: b.dailyLimit })
      .where(eq(memberApiSharesTable.id, b.id))
  }
  return Response.json({ ok: true })
}
