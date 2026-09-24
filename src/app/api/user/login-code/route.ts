import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'
import { getCurrentUser, sha256 } from '@/utils/user'

export async function POST() {
  const user = await getCurrentUser()
  if (!user.userEmail || user.isAdmin) return NextResponse.json({ error: '只有体验用户可以创建个人登录码' }, { status: 403 })
  const code = randomBytes(24).toString('base64url').toUpperCase()
  await getDb().update(sessionsTable).set({ loginCodeHash: sha256(code) }).where(eq(sessionsTable.id, user.userId))
  return NextResponse.json({ code })
}
