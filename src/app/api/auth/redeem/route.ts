import { randomBytes, timingSafeEqual } from 'crypto'
import { and, eq, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { inviteCodesTable, sessionsTable } from '@/db/schema'
import { SESSION_COOKIE, sha256 } from '@/utils/user'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => null)
  const code = typeof input?.code === 'string' ? input.code.trim() : ''
  if (code.length < 12 || code.length > 128) {
    return NextResponse.json({ error: '邀请码无效' }, { status: 400 })
  }

  const adminCode = process.env.BOOTSTRAP_ADMIN_CODE || ''
  const admin = adminCode.length >= 20 &&
    timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(sha256(adminCode)))
  const db = getDb()
  let inviteCodeId: number | null = null

  if (!admin) {
    // Conditional UPDATE consumes at most max_uses, even with concurrent requests.
    const consumed = await db.update(inviteCodesTable)
      .set({ usedCount: sql`${inviteCodesTable.usedCount} + 1` })
      .where(and(
        eq(inviteCodesTable.codeHash, sha256(code.toUpperCase())),
        sql`${inviteCodesTable.usedCount} < ${inviteCodesTable.maxUses}`,
        sql`(${inviteCodesTable.expiresAt} IS NULL OR ${inviteCodesTable.expiresAt} > NOW())`,
      ))
      .returning({ id: inviteCodesTable.id })
    if (!consumed[0]) {
      return NextResponse.json({ error: '邀请码无效或已用完' }, { status: 403 })
    }
    inviteCodeId = consumed[0].id
  }

  const token = randomBytes(32).toString('hex')
  await db.insert(sessionsTable).values({
    tokenHash: sha256(token), inviteCodeId,
    role: admin ? 'admin' : 'member',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })
  const response = NextResponse.json({ ok: true, role: admin ? 'admin' : 'member' })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60,
  })
  return response
}
