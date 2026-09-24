import { randomBytes } from 'crypto'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { inviteCodesTable } from '@/db/schema'
import { getCurrentUser, sha256 } from '@/utils/user'

export async function GET() {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const codes = await getDb().select({
    id: inviteCodesTable.id, label: inviteCodesTable.label, maxUses: inviteCodesTable.maxUses,
    usedCount: inviteCodesTable.usedCount, teamAccess: inviteCodesTable.teamAccess,
    expiresAt: inviteCodesTable.expiresAt,
    createdAt: inviteCodesTable.createdAt,
  }).from(inviteCodesTable)
  return NextResponse.json({ codes })
}

export async function POST(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const input = await request.json().catch(() => null)
  const maxUses = Number(input?.maxUses ?? 1)
  const label = String(input?.label || '').slice(0, 120)
  const teamAccess = input?.teamAccess === true
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
    return NextResponse.json({ error: 'maxUses must be 1–100' }, { status: 400 })
  }
  const code = randomBytes(18).toString('base64url').toUpperCase()
  await getDb().insert(inviteCodesTable).values({ codeHash: sha256(code), label, maxUses, teamAccess })
  return NextResponse.json({ code }) // Plaintext is shown only once.
}

export async function DELETE(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = Number(request.nextUrl.searchParams.get('id'))
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: '邀请码 ID 无效' }, { status: 400 })
  }
  const [closed] = await getDb().update(inviteCodesTable)
    .set({ expiresAt: new Date() })
    .where(and(eq(inviteCodesTable.id, id), gt(inviteCodesTable.maxUses, inviteCodesTable.usedCount),
      or(isNull(inviteCodesTable.expiresAt), gt(inviteCodesTable.expiresAt, new Date()))))
    .returning({ id: inviteCodesTable.id })
  if (!closed) return NextResponse.json({ error: '邀请码不存在、已关闭或已用完' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
