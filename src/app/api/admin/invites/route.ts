import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { apiGrantsTable, inviteCodesTable, sessionsTable } from '@/db/schema'
import { getCurrentUser, sha256 } from '@/utils/user'

export async function GET() {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const codes = await getDb().select({
    id: inviteCodesTable.id, label: inviteCodesTable.label, maxUses: inviteCodesTable.maxUses,
    usedCount: inviteCodesTable.usedCount, dailyMaxUses: inviteCodesTable.dailyMaxUses,
    dailyUsedCount: inviteCodesTable.dailyUsedCount, dailyUsedOn: inviteCodesTable.dailyUsedOn,
    teamAccess: inviteCodesTable.teamAccess,
    expiresAt: inviteCodesTable.expiresAt,
    createdAt: inviteCodesTable.createdAt,
  }).from(inviteCodesTable)
  return NextResponse.json({ codes })
}

export async function POST(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const input = await request.json().catch(() => null)
  const maxUses = Number(input?.maxUses ?? 1)
  const dailyMaxUses = input?.dailyMaxUses == null || input.dailyMaxUses === '' ? null : Number(input.dailyMaxUses)
  const label = String(input?.label || '').slice(0, 120)
  const teamAccess = input?.teamAccess === true
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000 ||
      (dailyMaxUses !== null && (!Number.isInteger(dailyMaxUses) || dailyMaxUses < 1 || dailyMaxUses > 1000))) {
    return NextResponse.json({ error: '总次数和每天次数须为 1–1000' }, { status: 400 })
  }
  const code = randomBytes(18).toString('base64url').toUpperCase()
  await getDb().insert(inviteCodesTable).values({ codeHash: sha256(code), label, maxUses, dailyMaxUses, teamAccess })
  return NextResponse.json({ code }) // Plaintext is shown only once.
}

export async function DELETE(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = Number(request.nextUrl.searchParams.get('id'))
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: '邀请码 ID 无效' }, { status: 400 })
  }
  const db = getDb()
  if (request.nextUrl.searchParams.get('remove') === '1') {
    const members = await db.select({ id: sessionsTable.id }).from(sessionsTable)
      .where(eq(sessionsTable.inviteCodeId, id)).limit(1)
    if (members.length) return NextResponse.json({ error: '先撤销由此邀请码加入的成员，才能删除邀请码' }, { status: 409 })
    await db.transaction(async tx => {
      await tx.delete(apiGrantsTable).where(eq(apiGrantsTable.inviteCodeId, id))
      await tx.delete(inviteCodesTable).where(eq(inviteCodesTable.id, id))
    })
    return NextResponse.json({ ok: true })
  }
  const [closed] = await db.update(inviteCodesTable).set({ expiresAt: new Date() })
    .where(eq(inviteCodesTable.id, id)).returning({ id: inviteCodesTable.id })
  if (!closed) return NextResponse.json({ error: '邀请码不存在' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const input = await request.json().catch(() => null)
  const id = Number(input?.id)
  const maxUses = Number(input?.maxUses)
  const dailyMaxUses = input?.dailyMaxUses == null || input.dailyMaxUses === '' ? null : Number(input.dailyMaxUses)
  if (!Number.isInteger(id) || id < 1 || typeof input?.label !== 'string' || input.label.length > 120 ||
      !Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000 ||
      (dailyMaxUses !== null && (!Number.isInteger(dailyMaxUses) || dailyMaxUses < 1 || dailyMaxUses > 1000)) ||
      typeof input?.teamAccess !== 'boolean' ||
      typeof input?.active !== 'boolean') {
    return NextResponse.json({ error: '邀请码参数无效' }, { status: 400 })
  }
  const db = getDb()
  const [current] = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.id, id)).limit(1)
  if (!current) return NextResponse.json({ error: '邀请码不存在' }, { status: 404 })
  if (maxUses < current.usedCount) return NextResponse.json({ error: '使用上限不能低于已使用次数' }, { status: 400 })
  const [updated] = await db.update(inviteCodesTable).set({
    label: input.label.trim(), maxUses, dailyMaxUses, teamAccess: input.teamAccess,
    expiresAt: input.active ? null : new Date(),
  }).where(eq(inviteCodesTable.id, id)).returning({ id: inviteCodesTable.id })
  return NextResponse.json({ ok: Boolean(updated) })
}
