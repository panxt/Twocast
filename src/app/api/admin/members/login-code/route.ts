import { randomBytes } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'
import { getCurrentUser, sha256 } from '@/utils/user'

export async function POST(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const userId = Number(body?.userId)
  if (!Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ error: '成员参数无效' }, { status: 400 })
  }
  const code = randomBytes(24).toString('base64url').toUpperCase()
  const [member] = await getDb().update(sessionsTable)
    .set({ loginCodeHash: sha256(code) })
    .where(and(eq(sessionsTable.id, userId), eq(sessionsTable.role, 'member')))
    .returning({ id: sessionsTable.id })
  if (!member) return NextResponse.json({ error: '成员不存在' }, { status: 404 })
  return NextResponse.json({ userId, code }, { headers: { 'cache-control': 'no-store' } })
}
