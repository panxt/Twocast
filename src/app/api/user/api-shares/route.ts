import { and, desc, eq, gt, or } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { memberApiSharesTable, sessionsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { getUserSettings, SettingKey } from '@/lib/settings'

const requiredKeys: Record<'llm' | 'tts', SettingKey[]> = {
  llm: ['LLM_CHAT_URL', 'LLM_CHAT_MODEL', 'LLM_API_KEY'],
  tts: ['MINIMAX_GROUP_ID', 'MINIMAX_TOKEN'],
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const db = getDb()
  const users = await db.select({ id: sessionsTable.id, displayName: sessionsTable.displayName })
    .from(sessionsTable).where(and(eq(sessionsTable.role, 'member'), gt(sessionsTable.expiresAt, new Date())))
  const shares = await db.select().from(memberApiSharesTable)
    .where(user.isAdmin ? undefined : or(eq(memberApiSharesTable.ownerUserId, user.userId),
      eq(memberApiSharesTable.recipientUserId, user.userId)))
    .orderBy(desc(memberApiSharesTable.createdAt))
  return NextResponse.json({ users, shares })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user.userEmail || user.isAdmin) return NextResponse.json({ error: '只有受邀成员能分享私有 API' }, { status: 403 })
  const input = await request.json().catch(() => null)
  const capability = input?.capability as 'llm' | 'tts'
  const recipientUserId = Number(input?.recipientUserId)
  const maxEpisodes = Number(input?.maxEpisodes)
  if (!(capability in requiredKeys) || !Number.isInteger(recipientUserId) || recipientUserId < 1 ||
      recipientUserId === user.userId || !Number.isInteger(maxEpisodes) || maxEpisodes < 1 || maxEpisodes > 1000) {
    return NextResponse.json({ error: '分享参数无效' }, { status: 400 })
  }
  const db = getDb()
  const [recipient] = await db.select({ id: sessionsTable.id }).from(sessionsTable)
    .where(and(eq(sessionsTable.id, recipientUserId), eq(sessionsTable.role, 'member'),
      gt(sessionsTable.expiresAt, new Date()))).limit(1)
  if (!recipient) return NextResponse.json({ error: '接收成员不存在或已停用' }, { status: 404 })
  const toggle = capability === 'llm' ? 'API_LLM_ENABLED' : 'API_TTS_ENABLED'
  const values = await getUserSettings(user.userId, [...requiredKeys[capability], toggle])
  if (values[toggle] === '0' || !requiredKeys[capability].every(key => Boolean(values[key]))) {
    return NextResponse.json({ error: '请先配置并启用自己的对应 API' }, { status: 400 })
  }
  const [share] = await db.insert(memberApiSharesTable).values({
    ownerUserId: user.userId, recipientUserId, capability, maxEpisodes,
  }).returning({ id: memberApiSharesTable.id })
  return NextResponse.json({ share })
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const input = await request.json().catch(() => null)
  const id = Number(input?.id)
  const maxEpisodes = Number(input?.maxEpisodes)
  if (!Number.isInteger(id) || id < 1 || typeof input?.active !== 'boolean' ||
      !Number.isInteger(maxEpisodes) || maxEpisodes < 1 || maxEpisodes > 1000) {
    return NextResponse.json({ error: '分享参数无效' }, { status: 400 })
  }
  const db = getDb()
  const [share] = await db.select().from(memberApiSharesTable).where(eq(memberApiSharesTable.id, id)).limit(1)
  if (!share || (!user.isAdmin && share.ownerUserId !== user.userId)) {
    return NextResponse.json({ error: '分享不存在' }, { status: 404 })
  }
  if (maxEpisodes < share.usedEpisodes) return NextResponse.json({ error: '总额度不能低于已使用次数' }, { status: 400 })
  await db.update(memberApiSharesTable).set({ active: input.active, maxEpisodes })
    .where(eq(memberApiSharesTable.id, id))
  return NextResponse.json({ ok: true })
}
