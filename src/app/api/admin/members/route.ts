import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'

export async function PATCH(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const userId = Number(body?.userId)
  if (!Number.isInteger(userId) || userId < 1 || typeof body?.teamAccess !== 'boolean') {
    return NextResponse.json({ error: '成员参数无效' }, { status: 400 })
  }
  const [member] = await getDb().update(sessionsTable)
    .set({ teamAccess: body.teamAccess })
    .where(and(eq(sessionsTable.id, userId), eq(sessionsTable.role, 'member')))
    .returning({ id: sessionsTable.id, teamAccess: sessionsTable.teamAccess })
  if (!member) return NextResponse.json({ error: '成员不存在' }, { status: 404 })
  return NextResponse.json({ member })
}
