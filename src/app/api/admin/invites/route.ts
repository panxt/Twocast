import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { inviteCodesTable } from '@/db/schema'
import { getCurrentUser, sha256 } from '@/utils/user'

export async function GET() {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const codes = await getDb().select({
    id: inviteCodesTable.id, label: inviteCodesTable.label, maxUses: inviteCodesTable.maxUses,
    usedCount: inviteCodesTable.usedCount, expiresAt: inviteCodesTable.expiresAt,
    createdAt: inviteCodesTable.createdAt,
  }).from(inviteCodesTable)
  return NextResponse.json({ codes })
}

export async function POST(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const input = await request.json().catch(() => null)
  const maxUses = Number(input?.maxUses ?? 1)
  const label = String(input?.label || '').slice(0, 120)
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
    return NextResponse.json({ error: 'maxUses must be 1–100' }, { status: 400 })
  }
  const code = randomBytes(18).toString('base64url').toUpperCase()
  await getDb().insert(inviteCodesTable).values({ codeHash: sha256(code), label, maxUses })
  return NextResponse.json({ code }) // Plaintext is shown only once.
}
