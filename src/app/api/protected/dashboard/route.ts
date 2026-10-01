import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { quotaPoliciesTable, quotaReservationsTable, tasksTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { taskScopeWhere } from '@/lib/podcast/scope'
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user.userEmail) return Response.json({ error: '请先登录' }, { status: 401 })
  const url = new URL(req.url)
  const teamId = Number(url.searchParams.get('team'))
  if (teamId && !user.isAdmin && !user.teamIds.includes(teamId))
    return Response.json({ error: '无权查看此团队' }, { status: 403 })
  const scope = url.searchParams.get('scope') || 'mine'
  const where = teamId
    ? and(
        taskScopeWhere(user, user.isAdmin ? 'all' : 'team'),
        sql`${tasksTable.sharedTeamIds}::jsonb @> ${JSON.stringify([teamId])}::jsonb`
      )
    : taskScopeWhere(user, scope)
  const db = getDb()
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      success: sql<number>`count(*) filter(where status='success')`.mapWith(Number),
      failed: sql<number>`count(*) filter(where status='failed')`.mapWith(Number),
      active: sql<number>`count(*) filter(where status in ('pending','processing'))`.mapWith(
        Number
      ),
      duration:
        sql<number>`coalesce(sum((${tasksTable.stepsDetail}::jsonb #>> '{audio,output,duration}')::float),0)`.mapWith(
          Number
        ),
      bytes: sql<number>`coalesce(sum(audio_bytes),0)`.mapWith(Number),
    })
    .from(tasksTable)
    .where(where)
  const [personalUsage] = await db
    .select({
      total: sql<number>`count(*) filter(where kind='generation')`.mapWith(Number),
      today:
        sql<number>`count(*) filter(where kind='generation' and ${quotaReservationsTable.createdAt} >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')`.mapWith(
          Number
        ),
    })
    .from(quotaReservationsTable)
    .leftJoin(tasksTable, eq(tasksTable.uuid, quotaReservationsTable.uuid))
    .where(
      and(
        eq(quotaReservationsTable.userId, user.userId),
        eq(quotaReservationsTable.cancelled, false),
        sql`(${tasksTable.status} is null or ${tasksTable.status}<>'failed')`
      )
    )
  const [personalStorage] = await db
    .select({
      bytes:
        sql<number>`coalesce(sum(${tasksTable.audioBytes}+coalesce(${quotaReservationsTable.bytes},0)),0)`.mapWith(
          Number
        ),
    })
    .from(tasksTable)
    .leftJoin(quotaReservationsTable, eq(tasksTable.uuid, quotaReservationsTable.uuid))
    .where(eq(tasksTable.userId, user.userId))
  const policies = await db.select().from(quotaPoliciesTable)
  const personalPolicy =
    policies.find((p) => p.scope === 'user' && p.scopeId === user.userId) ||
    policies.find((p) => p.scope === 'default') ||
    null
  const byDay = await db
    .select({
      day: sql<string>`to_char(${tasksTable.createdAt} at time zone 'Asia/Shanghai','YYYY-MM-DD')`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(tasksTable)
    .where(and(where, sql`${tasksTable.createdAt} > now()-interval '14 days'`))
    .groupBy(sql`1`)
    .orderBy(sql`1`)
  const byProvider = await db
    .select({
      provider: sql<string>`coalesce(${tasksTable.userInputs}::jsonb ->> 'platform','import')`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(tasksTable)
    .where(where)
    .groupBy(sql`1`)
  const platformStorage = user.isAdmin
    ? await db.execute(
        sql`select bucket_id as bucket, count(*)::int as objects, coalesce(sum((metadata->>'size')::bigint),0)::text as bytes from storage.objects where bucket_id in ('podcast-audio','podcast-files','podcast-covers','podcast-imports') group by bucket_id`
      )
    : null
  return Response.json(
    {
      stats,
      personalUsage,
      personalStorage,
      personalPolicy,
      byDay,
      byProvider,
      platformStorage,
      isAdmin: user.isAdmin,
      notes: [
        '供应商余额与账单未接入；次数统计不等于实际费用。',
        '存储总量包含临时分段；个人音频大小统计逐步补齐历史数据。',
        '失败任务不占生成次数；供应商已发生的费用不自动退还。',
      ],
    },
    { headers: { 'cache-control': 'no-store' } }
  )
}
