import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'
import { getCurrentUser, sha256 } from '@/utils/user'

export async function POST() {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  if (!user.userId) return NextResponse.json({ error: '本地免登录模式无需登录码' }, { status: 400 })
  const code = randomBytes(24).toString('base64url').toUpperCase()
  await getDb().update(sessionsTable).set({ loginCodeHash: sha256(code) }).where(eq(sessionsTable.id, user.userId))
  return NextResponse.json({ code }, { headers: { 'cache-control': 'no-store' } })
}
