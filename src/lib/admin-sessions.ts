import { and, eq, lt, ne, sql } from 'drizzle-orm'
import type { getDb } from '@/db/db'
import { sessionsTable, tasksTable } from '@/db/schema'

// 每次管理员登录都会新增一行会话；过期行没有任何用处，但有节目引用（tasks.user_id）的行
// 要保留，否则节目列表里"管理员"的归属会变成"用户 #n"。成员行同时是账号，这里不动。
export function staleAdminSessionFilter(keepId: number, cutoff: Date) {
  return and(
    eq(sessionsTable.role, 'admin'),
    ne(sessionsTable.id, keepId),
    lt(sessionsTable.expiresAt, cutoff),
    sql`NOT EXISTS (SELECT 1 FROM ${tasksTable} WHERE ${tasksTable.userId} = ${sessionsTable.id})`,
  )
}

export async function purgeExpiredAdminSessions(db: ReturnType<typeof getDb>, keepId: number, olderThanDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const removed = await db.delete(sessionsTable).where(staleAdminSessionFilter(keepId, cutoff)).returning({ id: sessionsTable.id })
  return removed.length
}
