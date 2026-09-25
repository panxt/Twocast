import 'server-only'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { apiGrantsTable, memberApiSharesTable, sessionsTable } from '@/db/schema'
import { getSettings, getUserSettings, SettingKey, ApiToggleKey } from './settings'
import { ApiAccess, ApiSource } from './api-context'
import { getShareChain } from './member-share-chain'
import { Platform } from './podcast/types'
import { CAPABILITY_LABELS, ShareCapability, TTS_CAPABILITIES } from './api-capabilities'

type User = { userId: number; inviteCodeId: number | null; isAdmin: boolean }
type Capability = 'llm' | 'tts'

async function configured(userId: number, keys: SettingKey[], own: boolean) {
  const values = own ? await getUserSettings(userId, keys) : await getSettings(keys)
  return keys.every(key => Boolean(values[key]))
}

async function enabled(userId: number, capability: Capability, own: boolean) {
  const key: ApiToggleKey = capability === 'llm' ? 'API_LLM_ENABLED' : 'API_TTS_ENABLED'
  const values = own ? await getUserSettings(userId, [key]) : await getSettings([key])
  return values[key] !== '0'
}

export const ttsSettingKeys: Record<Platform, SettingKey[]> = {
  [Platform.Minimax]: ['MINIMAX_GROUP_ID', 'MINIMAX_TOKEN'],
  [Platform.FishAudio]: ['FISH_AUDIO_TOKEN'],
  [Platform.Gemini]: ['GEMINI_TTS_API_KEY'],
}

export async function availableApiAccess(user: User, needsSearch: boolean, platform: Platform = Platform.Minimax) {
  const llmKeys: SettingKey[] = ['LLM_CHAT_URL', 'LLM_CHAT_MODEL', 'LLM_API_KEY']
  if (needsSearch) llmKeys.push('LLM_SEARCH_URL', 'LLM_SEARCH_MODEL', 'LLM_SEARCH_API_KEY')
  const ttsKeys = ttsSettingKeys[platform]
  const selection = await Promise.all([
    selectCapability(user, 'llm', llmKeys), selectCapability(user, 'tts', ttsKeys, platform),
  ])
  return { llm: selection[0], tts: selection[1] }
}

export async function availableTtsAccess(user: User, platform: Platform = Platform.Minimax) {
  return selectCapability(user, 'tts', ttsSettingKeys[platform], platform)
}

type Selection = { source: ApiSource; grantId?: number; memberShareId?: number; memberShareChainIds?: number[]; ownerUserId?: number; error?: string }

async function selectCapability(user: User, capability: Capability, keys: SettingKey[], platform: Platform = Platform.Minimax): Promise<Selection> {
  const shareCapability: ShareCapability = capability === 'llm' ? 'llm' : TTS_CAPABILITIES[platform]
  const label = CAPABILITY_LABELS[shareCapability]
  if (user.isAdmin) {
    if (!(await enabled(user.userId, capability, false))) return { source: 'admin', error: `${label} API 已停用，请在设置中启用` }
    return await configured(user.userId, keys, false) ? { source: 'admin' }
      : { source: 'admin', error: `${label} API 尚未配置` }
  }
  const ownEnabled = await enabled(user.userId, capability, true)
  const ownConfigured = await configured(user.userId, keys, true)
  if (ownEnabled && ownConfigured) return { source: 'own' }
  const shares = await getDb().select().from(memberApiSharesTable).where(and(
    eq(memberApiSharesTable.recipientUserId, user.userId), eq(memberApiSharesTable.capability, shareCapability),
    eq(memberApiSharesTable.active, true),
    sql`${memberApiSharesTable.usedEpisodes} < ${memberApiSharesTable.maxEpisodes}`,
  )).orderBy(memberApiSharesTable.id)
  for (const share of shares) {
    const chain = await getShareChain(share.id)
    if (!chain) continue
    const [owner] = await getDb().select({ id: sessionsTable.id }).from(sessionsTable).where(and(
      eq(sessionsTable.id, share.ownerUserId), gt(sessionsTable.expiresAt, new Date()),
      eq(sessionsTable.role, 'member'),
    )).limit(1)
    if (owner && await enabled(owner.id, capability, true) && await configured(owner.id, keys, true)) {
      return { source: 'member', memberShareId: share.id,
        memberShareChainIds: chain.map(item => item.id), ownerUserId: owner.id }
    }
  }
  const grants = await getDb().select().from(apiGrantsTable).where(and(
    eq(apiGrantsTable.capability, shareCapability),
    or(eq(apiGrantsTable.userId, user.userId), user.inviteCodeId ? eq(apiGrantsTable.inviteCodeId, user.inviteCodeId) : undefined),
  )).orderBy(sql`CASE WHEN ${apiGrantsTable.userId} IS NOT NULL THEN 0 ELSE 1 END`, apiGrantsTable.id)
  const grant = grants.find(item => item.usedEpisodes < item.maxEpisodes && (!item.expiresAt || item.expiresAt > new Date()))
  if (grant) {
    if (!(await enabled(user.userId, capability, false))) return { source: 'grant', error: `管理员已停用共享${label} API` }
    if (!(await configured(user.userId, keys, false))) return { source: 'grant', error: '管理员共享 API 尚未配置完整' }
    return { source: 'grant', grantId: grant.id }
  }
  return { source: 'grant', error: !ownEnabled && ownConfigured && !grants.length
    ? `自己的${label} API 已停用，且未获管理员共享授权`
    : grants.length
    ? `${label}共享额度已用完；请配置自己的 API 或联系管理员`
    : `未获管理员共享${label} API 授权；请配置自己的 API 或联系管理员` }
}

export async function reserveApiAccess(user: User, needsSearch: boolean, platform: Platform = Platform.Minimax): Promise<{
  access: ApiAccess; grantIds: number[]; memberShareIds: number[];
  keyOwners: { llm?: number; tts?: number }; keyShareIds: { llm?: number; tts?: number }
}> {
  const selection = await availableApiAccess(user, needsSearch, platform)
  if (selection.llm.error || selection.tts.error) throw new Error([selection.llm.error, selection.tts.error].filter(Boolean).join('；'))
  const reserved: number[] = []
  const reservedShares: number[] = []
  try {
    for (const item of [selection.llm, selection.tts]) {
      if (item.memberShareId) {
        for (const id of item.memberShareChainIds || [item.memberShareId]) {
          const rows = await getDb().update(memberApiSharesTable)
            .set({ usedEpisodes: sql`${memberApiSharesTable.usedEpisodes} + 1` })
            .where(and(eq(memberApiSharesTable.id, id),
              eq(memberApiSharesTable.active, true),
              sql`${memberApiSharesTable.usedEpisodes} < ${memberApiSharesTable.maxEpisodes}`))
            .returning({ id: memberApiSharesTable.id })
          if (!rows[0]) throw new Error('成员分享 API 额度刚刚用完，请重试')
          reservedShares.push(id)
        }
      }
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
    await releaseApiGrants(reserved, reservedShares)
    throw error
  }
  return { access: { llm: selection.llm.source, tts: selection.tts.source }, grantIds: reserved,
    memberShareIds: reservedShares,
    keyOwners: { llm: selection.llm.ownerUserId, tts: selection.tts.ownerUserId },
    keyShareIds: { llm: selection.llm.memberShareId, tts: selection.tts.memberShareId } }
}

export async function releaseApiGrants(ids: number[], memberShareIds: number[] = []) {
  for (const id of ids) await getDb().update(apiGrantsTable)
    .set({ usedEpisodes: sql`GREATEST(0, ${apiGrantsTable.usedEpisodes} - 1)` })
    .where(eq(apiGrantsTable.id, id))
  for (const id of memberShareIds) await getDb().update(memberApiSharesTable)
    .set({ usedEpisodes: sql`GREATEST(0, ${memberApiSharesTable.usedEpisodes} - 1)` })
    .where(eq(memberApiSharesTable.id, id))
}
