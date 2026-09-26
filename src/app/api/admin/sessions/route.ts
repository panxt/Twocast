import { ne, and, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { purgeExpiredAdminSessions } from '@/lib/admin-sessions'

// 撤销其他管理员会话，并顺手清掉早已过期、且没有节目引用的管理员会话行。
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user.isAdmin || !user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = getDb()
  const revoked = await db.update(sessionsTable).set({ expiresAt: new Date() })
    .where(and(eq(sessionsTable.role, 'admin'), ne(sessionsTable.id, user.userId), sql`${sessionsTable.expiresAt} > NOW()`))
    .returning({ id: sessionsTable.id })
  const purged = await purgeExpiredAdminSessions(db, user.userId)
  return NextResponse.json({ revoked: revoked.length, purged })
}
