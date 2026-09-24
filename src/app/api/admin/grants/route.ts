import { NextRequest, NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { apiGrantsTable, inviteCodesTable, sessionsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'

export async function GET() {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = getDb()
  try {
    // Serverless uses a single pooler connection. Keep these small reads
    // sequential so one failed query cannot leave other promises unhandled.
    const grants = await db.select().from(apiGrantsTable).orderBy(desc(apiGrantsTable.createdAt))
    const users = await db.select({ id: sessionsTable.id, displayName: sessionsTable.displayName,
      inviteCodeId: sessionsTable.inviteCodeId, role: sessionsTable.role,
      teamAccess: sessionsTable.teamAccess }).from(sessionsTable)
      .where(eq(sessionsTable.role, 'member')).orderBy(desc(sessionsTable.id))
    const codes = await db.select({ id: inviteCodesTable.id, label: inviteCodesTable.label,
      usedCount: inviteCodesTable.usedCount, maxUses: inviteCodesTable.maxUses,
      teamAccess: inviteCodesTable.teamAccess, expiresAt: inviteCodesTable.expiresAt }).from(inviteCodesTable)
      .orderBy(desc(inviteCodesTable.createdAt))
    return NextResponse.json({ grants, users, codes })
  } catch (error) {
    console.error('Failed to list API grants', error)
    return NextResponse.json({ error: '授权列表暂时不可用，请稍后重试' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json().catch(() => null)
  const capability = body?.capability
  const maxEpisodes = Number(body?.maxEpisodes)
  const userId = body?.userId == null ? null : Number(body.userId)
  const inviteCodeId = body?.inviteCodeId == null ? null : Number(body.inviteCodeId)
  if (!['llm', 'tts'].includes(capability) || !Number.isInteger(maxEpisodes) || maxEpisodes < 1 || maxEpisodes > 1000 ||
      (userId === null) === (inviteCodeId === null) ||
      (userId !== null && (!Number.isInteger(userId) || userId < 1)) ||
      (inviteCodeId !== null && (!Number.isInteger(inviteCodeId) || inviteCodeId < 1))) {
    return NextResponse.json({ error: '授权参数无效' }, { status: 400 })
  }
  const [grant] = await getDb().insert(apiGrantsTable).values({ userId, inviteCodeId, capability, maxEpisodes }).returning()
  return NextResponse.json({ grant })
}

export async function DELETE(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: '授权 ID 无效' }, { status: 400 })
  await getDb().delete(apiGrantsTable).where(eq(apiGrantsTable.id, id))
  return NextResponse.json({ ok: true })
}
