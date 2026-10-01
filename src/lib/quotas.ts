import 'server-only'
import { and, eq, or, sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import {
  quotaPoliciesTable,
  quotaReservationsTable,
  tasksTable,
  teamsTable,
  teamMembersTable,
} from '@/db/schema'
import type { NewTask } from '@/db/types'
import { TaskStatus } from '@/types/task'

type User = { userId: number; isAdmin: boolean; teamIds: number[] }
export type QuotaPolicy = typeof quotaPoliciesTable.$inferSelect
export function quotaExceeded(
  policy: Pick<QuotaPolicy, 'dailyLimit' | 'totalLimit' | 'concurrentLimit' | 'storageBytes'>,
  usage: { today: number; total: number; active: number; bytes: number },
  bytes = 0
): string | null {
  if (policy.dailyLimit !== null && usage.today >= policy.dailyLimit)
    return '今日生成额度已用完（北京时间 08:00 重置）'
  if (policy.totalLimit !== null && usage.total >= policy.totalLimit) return '总生成额度已用完'
  if (policy.concurrentLimit !== null && usage.active >= policy.concurrentLimit)
    return '同时生成的任务已达上限，请等待任务完成'
  if (policy.storageBytes !== null && usage.bytes + bytes > policy.storageBytes)
    return '存储额度不足，请清理文件或联系管理员调整额度'
  return null
}

// All submissions and policy updates use the same short transaction lock. Task and
// quota admission commit together; concurrent requests cannot both take the last slot.
export async function admitTask(
  user: User,
  task: NewTask,
  teamId: number | null,
  bytes = 0,
  kind = 'generation'
) {
  if (teamId !== null && !user.isAdmin && !user.teamIds.includes(teamId))
    throw new Error('不能使用其他团队的额度')
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(86470123)`)
    if (teamId !== null) {
      const [team] = await tx
        .select()
        .from(teamsTable)
        .where(and(eq(teamsTable.id, teamId), eq(teamsTable.active, true)))
      if (!team) throw new Error('所选团队不存在或已停用')
      if (!user.isAdmin) {
        const [membership] = await tx
          .select()
          .from(teamMembersTable)
          .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, user.userId)))
        if (!membership) throw new Error('团队成员权限已撤销')
      }
    }

    const policies = await tx
      .select()
      .from(quotaPoliciesTable)
      .where(
        or(
          eq(quotaPoliciesTable.scope, 'platform'),
          eq(quotaPoliciesTable.scope, 'default'),
          and(eq(quotaPoliciesTable.scope, 'user'), eq(quotaPoliciesTable.scopeId, user.userId)),
          teamId
            ? and(eq(quotaPoliciesTable.scope, 'team'), eq(quotaPoliciesTable.scopeId, teamId))
            : undefined
        )
      )
    const own =
      policies.find((p) => p.scope === 'user') || policies.find((p) => p.scope === 'default')
    const effective = policies.filter((p) => p.scope === 'platform' || p.scope === 'team')
    if (own) effective.push(own)
    for (const p of effective) {
      const scope =
        p.scope === 'platform'
          ? sql`true`
          : p.scope === 'team'
            ? eq(quotaReservationsTable.teamId, p.scopeId)
            : eq(quotaReservationsTable.userId, user.userId)
      const [usage] = await tx
        .select({
          total:
            sql<number>`count(*) filter (where ${quotaReservationsTable.kind}='generation' and (${tasksTable.status} is null or ${tasksTable.status}<>'failed'))`.mapWith(
              Number
            ),
          today:
            sql<number>`count(*) filter (where ${quotaReservationsTable.kind}='generation' and (${tasksTable.status} is null or ${tasksTable.status}<>'failed') and ${quotaReservationsTable.createdAt} >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')`.mapWith(
              Number
            ),
          active:
            sql<number>`count(*) filter (where ${tasksTable.status} in ('pending','processing'))`.mapWith(
              Number
            ),
          bytes:
            sql<number>`coalesce(sum(case when ${tasksTable.id} is not null then (${quotaReservationsTable.bytes}+${tasksTable.audioBytes}) else 0 end),0)`.mapWith(
              Number
            ),
        })
        .from(quotaReservationsTable)
        .leftJoin(tasksTable, eq(tasksTable.uuid, quotaReservationsTable.uuid))
        .where(and(scope, eq(quotaReservationsTable.cancelled, false)))
      const error = quotaExceeded(
        kind === 'generation'
          ? p
          : { ...p, dailyLimit: null, totalLimit: null, concurrentLimit: null },
        usage,
        bytes
      )
      if (error)
        throw new Error(
          `${p.scope === 'platform' ? '平台' : p.scope === 'team' ? '团队' : '个人'}：${error}`
        )
    }
    await tx.insert(quotaReservationsTable).values({
      uuid: task.uuid,
      userId: user.userId,
      teamId,
      bytes: kind === 'import' ? 0 : bytes,
      kind,
    })
    const [saved] = await tx
      .insert(tasksTable)
      .values({ ...task, quotaTeamId: teamId, audioBytes: kind === 'import' ? bytes : 0 })
      .returning({ id: tasksTable.id })
    return saved.id
  })
}

export async function reserveFinalAudio(uuid: string, bytes: number) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(86470123)`)
    const [task] = await tx.select().from(tasksTable).where(eq(tasksTable.uuid, uuid))
    if (!task) throw new Error('任务不存在')
    const all = await tx.select().from(quotaPoliciesTable)
    const own =
      all.find((p) => p.scope === 'user' && p.scopeId === task.userId) ||
      all.find((p) => p.scope === 'default')
    const policies = all.filter(
      (p) => p.scope === 'platform' || (p.scope === 'team' && p.scopeId === task.quotaTeamId)
    )
    if (own) policies.push(own)
    for (const p of policies) {
      if (p.storageBytes === null) continue
      const scope =
        p.scope === 'platform'
          ? sql`true`
          : p.scope === 'team'
            ? eq(tasksTable.quotaTeamId, p.scopeId)
            : eq(tasksTable.userId, task.userId)
      const [usage] = await tx
        .select({
          bytes:
            sql<number>`coalesce(sum(${tasksTable.audioBytes}+coalesce(${quotaReservationsTable.bytes},0)),0)`.mapWith(
              Number
            ),
        })
        .from(tasksTable)
        .leftJoin(quotaReservationsTable, eq(tasksTable.uuid, quotaReservationsTable.uuid))
        .where(and(scope, sql`${tasksTable.uuid} <> ${uuid}`))
      const [reservation] = await tx
        .select()
        .from(quotaReservationsTable)
        .where(eq(quotaReservationsTable.uuid, uuid))
      if (usage.bytes + bytes + (reservation?.bytes || 0) > p.storageBytes)
        throw new Error('生成的音频超出存储额度，请联系管理员调整额度')
    }
    await tx.update(tasksTable).set({ audioBytes: bytes }).where(eq(tasksTable.uuid, uuid))
  })
}
