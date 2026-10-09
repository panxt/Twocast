import { and, eq, isNull, lt, ne, sql } from 'drizzle-orm'
import type { getDb } from '@/db/db'
import { sessionsTable, tasksTable } from '@/db/schema'

// Only obsolete bootstrap identities are eligible. Invited administrators are stable accounts.
export function staleAdminSessionFilter(keepId: number, cutoff: Date) {
  return and(
    eq(sessionsTable.role, 'admin'),
    isNull(sessionsTable.inviteCodeId),
    ne(sessionsTable.id, keepId),
    lt(sessionsTable.expiresAt, cutoff),
    isNull(sessionsTable.loginCodeHash),
    sql`NOT EXISTS (SELECT 1 FROM ${tasksTable} WHERE ${tasksTable.userId} = ${sessionsTable.id})`
  )
}

export async function purgeExpiredAdminSessions(
  db: ReturnType<typeof getDb>,
  keepId: number,
  olderThanDays = 7
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const removed = await db
    .delete(sessionsTable)
    .where(staleAdminSessionFilter(keepId, cutoff))
    .returning({ id: sessionsTable.id })
  return removed.length
}
