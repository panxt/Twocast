import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { tasksTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
export async function GET() {
  const user = await getCurrentUser()
  if (!user.userEmail) return Response.json({ error: '请先登录' }, { status: 401 })
  const items = await getDb()
    .select({
      uuid: tasksTable.uuid,
      deletedAt: tasksTable.deletedAt,
      title: sql<string>`${tasksTable.stepsDetail}::jsonb #>> '{audio,input,title}'`,
      status: tasksTable.status,
    })
    .from(tasksTable)
    .where(
      and(
        isNotNull(tasksTable.deletedAt),
        user.isAdmin ? undefined : eq(tasksTable.userEmail, user.userEmail)
      )
    )
    .orderBy(desc(tasksTable.deletedAt))
    .limit(100)
  return Response.json({ items })
}
export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user.userEmail) return Response.json({ error: '请先登录' }, { status: 401 })
  const b = await req.json().catch(() => null)
  if (typeof b?.uuid !== 'string') return Response.json({ error: '作品参数无效' }, { status: 400 })
  const [restored] = await getDb()
    .update(tasksTable)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(tasksTable.uuid, b.uuid),
        sql`${tasksTable.deletedAt}>now()-interval '7 days'`,
        user.isAdmin ? undefined : eq(tasksTable.userEmail, user.userEmail)
      )
    )
    .returning({ uuid: tasksTable.uuid })
  if (!restored)
    return Response.json({ error: '作品不存在、无权限或已超过保留期' }, { status: 404 })
  return Response.json({ ok: true })
}
