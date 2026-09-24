import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user.userEmail || user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : ''
  if (!displayName || displayName.length > 40) return NextResponse.json({ error: '昵称需为 1–40 字' }, { status: 400 })
  await getDb().update(sessionsTable).set({ displayName }).where(eq(sessionsTable.id, user.userId))
  return NextResponse.json({ ok: true })
}
