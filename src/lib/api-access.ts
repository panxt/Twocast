import 'server-only'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { apiGrantsTable } from '@/db/schema'
import { getSetting, getUserSetting, SettingKey } from './settings'
import { ApiAccess, ApiSource } from './api-context'

type User = { userId: number; inviteCodeId: number | null; isAdmin: boolean }
type Capability = 'llm' | 'tts'

async function configured(userId: number, keys: SettingKey[], own: boolean) {
  const values = await Promise.all(keys.map(key => own ? getUserSetting(userId, key) : getSetting(key)))
  return values.every(Boolean)
}

export async function availableApiAccess(user: User, needsSearch: boolean) {
  const llmKeys: SettingKey[] = ['LLM_CHAT_URL', 'LLM_CHAT_MODEL', 'LLM_API_KEY']
  if (needsSearch) llmKeys.push('LLM_SEARCH_URL', 'LLM_SEARCH_MODEL', 'LLM_SEARCH_API_KEY')
  const ttsKeys: SettingKey[] = ['MINIMAX_GROUP_ID', 'MINIMAX_TOKEN']
  const selection = await Promise.all([
    selectCapability(user, 'llm', llmKeys), selectCapability(user, 'tts', ttsKeys),
  ])
  return { llm: selection[0], tts: selection[1] }
}

async function selectCapability(user: User, capability: Capability, keys: SettingKey[]): Promise<{ source: ApiSource; grantId?: number; error?: string }> {
  if (user.isAdmin) {
    return await configured(user.userId, keys, false) ? { source: 'admin' }
      : { source: 'admin', error: `${capability === 'llm' ? '大模型' : 'MiniMax TTS'} 尚未配置` }
  }
  if (await configured(user.userId, keys, true)) return { source: 'own' }
  const grants = await getDb().select().from(apiGrantsTable).where(and(
    eq(apiGrantsTable.capability, capability),
    or(eq(apiGrantsTable.userId, user.userId), user.inviteCodeId ? eq(apiGrantsTable.inviteCodeId, user.inviteCodeId) : undefined),
  )).orderBy(sql`CASE WHEN ${apiGrantsTable.userId} IS NOT NULL THEN 0 ELSE 1 END`, apiGrantsTable.id)
  const grant = grants.find(item => item.usedEpisodes < item.maxEpisodes && (!item.expiresAt || item.expiresAt > new Date()))
  if (grant) {
    if (!(await configured(user.userId, keys, false))) return { source: 'grant', error: '管理员共享 API 尚未配置完整' }
    return { source: 'grant', grantId: grant.id }
  }
  return { source: 'grant', error: grants.length
    ? `${capability === 'llm' ? '大模型' : '语音'}共享额度已用完；请配置自己的 API 或联系管理员`
    : `未获管理员共享${capability === 'llm' ? '大模型' : '语音'} API 授权；请配置自己的 API 或联系管理员` }
}

export async function reserveApiAccess(user: User, needsSearch: boolean): Promise<{ access: ApiAccess; grantIds: number[] }> {
  const selection = await availableApiAccess(user, needsSearch)
  if (selection.llm.error || selection.tts.error) throw new Error([selection.llm.error, selection.tts.error].filter(Boolean).join('；'))
  const reserved: number[] = []
  try {
    for (const item of [selection.llm, selection.tts]) {
      if (!item.grantId) continue
      const rows = await getDb().update(apiGrantsTable).set({ usedEpisodes: sql`${apiGrantsTable.usedEpisodes} + 1` })
        .where(and(eq(apiGrantsTable.id, item.grantId),
          sql`${apiGrantsTable.usedEpisodes} < ${apiGrantsTable.maxEpisodes}`,
          or(isNull(apiGrantsTable.expiresAt), gt(apiGrantsTable.expiresAt, new Date()))))
        .returning({ id: apiGrantsTable.id })
      if (!rows[0]) throw new Error('共享 API 额度刚刚用完，请重试或使用自己的 API')
      reserved.push(item.grantId)
    }
  } catch (error) {
    await releaseApiGrants(reserved)
    throw error
  }
  return { access: { llm: selection.llm.source, tts: selection.tts.source }, grantIds: reserved }
}

export async function releaseApiGrants(ids: number[]) {
  for (const id of ids) await getDb().update(apiGrantsTable)
    .set({ usedEpisodes: sql`GREATEST(0, ${apiGrantsTable.usedEpisodes} - 1)` })
    .where(eq(apiGrantsTable.id, id))
}
