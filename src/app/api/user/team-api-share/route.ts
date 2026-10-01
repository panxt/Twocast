import { and, eq, gt, inArray } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { memberApiSharesTable, teamMembersTable, sessionsTable, teamsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { getUserSettings, type SettingKey } from '@/lib/settings'
import { isShareCapability } from '@/lib/api-capabilities'
import { ttsSettingKeys } from '@/lib/api-access'
import { Platform } from '@/lib/podcast/types'
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user.userId) return Response.json({ error: '请先登录' }, { status: 401 })
  const b = await req.json().catch(() => null)
  if (
    !b ||
    !isShareCapability(b.capability) ||
    !Number.isInteger(b.teamId) ||
    !user.teamIds.includes(b.teamId) ||
    !Number.isInteger(b.maxEpisodes) ||
    b.maxEpisodes < 1 ||
    b.maxEpisodes > 1000
  )
    return Response.json({ error: '请选择自己所在的团队，额度须为 1–1000' }, { status: 400 })
  const keys: SettingKey[] =
    b.capability === 'llm'
      ? ['LLM_CHAT_URL', 'LLM_CHAT_MODEL', 'LLM_API_KEY']
      : ttsSettingKeys[b.capability.slice(4) as Platform]
  const toggle = b.capability === 'llm' ? 'API_LLM_ENABLED' : 'API_TTS_ENABLED'
  const values = await getUserSettings(user.userId, [...keys, toggle])
  if (values[toggle] === '0' || !keys.every((k) => values[k]))
    return Response.json({ error: '请先配置并启用自己的对应 API' }, { status: 400 })
  const db = getDb()
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, b.teamId), eq(teamsTable.active, true)))
  if (!team) return Response.json({ error: '团队已停用' }, { status: 403 })
  const members = await db
    .select({ id: teamMembersTable.userId })
    .from(teamMembersTable)
    .innerJoin(sessionsTable, eq(sessionsTable.id, teamMembersTable.userId))
    .where(and(eq(teamMembersTable.teamId, b.teamId), gt(sessionsTable.expiresAt, new Date())))
  const recipients = members.filter((m) => m.id !== user.userId)
  if (!recipients.length || recipients.length > 200)
    return Response.json({ error: '可分享成员须为 1–200 人' }, { status: 400 })
  await db
    .insert(memberApiSharesTable)
    .values(
      recipients.map((m) => ({
        ownerUserId: user.userId,
        recipientUserId: m.id,
        delegatedByUserId: user.userId,
        capability: b.capability,
        maxEpisodes: b.maxEpisodes,
      }))
    )
  return Response.json({ ok: true, members: recipients.length })
}
