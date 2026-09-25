import { ne, and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user.isAdmin || !user.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const revoked = await getDb().update(sessionsTable).set({ expiresAt: new Date() })
    .where(and(eq(sessionsTable.role, 'admin'), ne(sessionsTable.id, user.userId)))
    .returning({ id: sessionsTable.id })
  return NextResponse.json({ revoked: revoked.length })
}
