import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { and, eq, gt, inArray } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { appSettingsTable, sessionsTable, userApiSettingsTable } from '@/db/schema'
import { currentApiContext } from './api-context'
import { getShareChain } from './member-share-chain'
import { TTS_CAPABILITIES } from './api-capabilities'
import { Platform } from './podcast/types'

export const SETTING_KEYS = [
  'LLM_CHAT_URL', 'LLM_CHAT_MODEL', 'LLM_API_KEY',
  'LLM_SEARCH_URL', 'LLM_SEARCH_MODEL', 'LLM_SEARCH_API_KEY',
  'MINIMAX_GROUP_ID', 'MINIMAX_TOKEN',
  'FISH_AUDIO_TOKEN', 'FISH_AUDIO_MODEL', 'GEMINI_TTS_API_KEY', 'GEMINI_TTS_MODEL',
  'API_LLM_ENABLED', 'API_TTS_ENABLED',
] as const
export type SettingKey = typeof SETTING_KEYS[number]
export type ApiToggleKey = 'API_LLM_ENABLED' | 'API_TTS_ENABLED'

function encryptionKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY || ''
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('SETTINGS_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return key
}

export function encrypt(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
}

export function decrypt(value: string): string {
  const bytes = Buffer.from(value, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12))
  decipher.setAuthTag(bytes.subarray(12, 28))
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
}

export async function getSetting(key: SettingKey): Promise<string> {
  const rows = await getDb().select().from(appSettingsTable).where(eq(appSettingsTable.key, key)).limit(1)
  return rows[0] ? decrypt(rows[0].encryptedValue) : (process.env[key] || '')
}

export async function getSettings(keys: readonly SettingKey[]): Promise<Record<SettingKey, string>> {
  const rows = await getDb().select().from(appSettingsTable).where(inArray(appSettingsTable.key, [...keys]))
  const stored = new Map(rows.map(row => [row.key, decrypt(row.encryptedValue)]))
  return Object.fromEntries(keys.map(key => [key, stored.get(key) ?? process.env[key] ?? ''])) as Record<SettingKey, string>
}

export async function setSetting(key: SettingKey, value: string) {
  await getDb().insert(appSettingsTable).values({ key, encryptedValue: encrypt(value), updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { encryptedValue: encrypt(value), updatedAt: new Date() } })
}

export async function getUserSetting(userId: number, key: SettingKey): Promise<string> {
  const rows = await getDb().select().from(userApiSettingsTable).where(and(
    eq(userApiSettingsTable.userId, userId), eq(userApiSettingsTable.key, key),
  )).limit(1)
  return rows[0] ? decrypt(rows[0].encryptedValue) : ''
}

export async function getUserSettings(userId: number, keys: readonly SettingKey[]): Promise<Record<SettingKey, string>> {
  const rows = await getDb().select().from(userApiSettingsTable).where(and(
    eq(userApiSettingsTable.userId, userId), inArray(userApiSettingsTable.key, [...keys]),
  ))
  const stored = new Map(rows.map(row => [row.key, decrypt(row.encryptedValue)]))
  return Object.fromEntries(keys.map(key => [key, stored.get(key) ?? ''])) as Record<SettingKey, string>
}

export async function setUserSetting(userId: number, key: SettingKey, value: string) {
  const encryptedValue = encrypt(value)
  await getDb().insert(userApiSettingsTable).values({ userId, key, encryptedValue, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [userApiSettingsTable.userId, userApiSettingsTable.key],
      set: { encryptedValue, updatedAt: new Date() } })
}

export async function getApiSetting(key: SettingKey): Promise<string> {
  const context = currentApiContext()
  const capability = key.startsWith('MINIMAX_') || key.startsWith('FISH_AUDIO_') || key.startsWith('GEMINI_TTS_') ? 'tts' : 'llm'
  const shareCapability = capability === 'llm' ? 'llm'
    : key.startsWith('MINIMAX_') ? TTS_CAPABILITIES[Platform.Minimax]
    : key.startsWith('FISH_AUDIO_') ? TTS_CAPABILITIES[Platform.FishAudio]
    : TTS_CAPABILITIES[Platform.Gemini]
  if (context?.access[capability] === 'own') return getUserSetting(context.userId, key)
  if (context?.access[capability] === 'member') {
    const ownerId = context.keyOwners?.[capability]
    const shareId = context.keyShareIds?.[capability]
    if (!ownerId || !shareId) throw new Error('成员 API 分享已失效')
    const chain = await getShareChain(shareId, false)
    const share = chain?.[0]
    const [owner] = await getDb().select({ id: sessionsTable.id }).from(sessionsTable).where(and(
      eq(sessionsTable.id, ownerId), eq(sessionsTable.role, 'member'),
      gt(sessionsTable.expiresAt, new Date()))).limit(1)
    const toggle = capability === 'llm' ? 'API_LLM_ENABLED' : 'API_TTS_ENABLED'
    if (!share || share.ownerUserId !== ownerId || share.recipientUserId !== context.userId ||
      share.capability !== shareCapability || !owner || await getUserSetting(ownerId, toggle) === '0') {
      throw new Error('成员 API 分享已停用')
    }
    return getUserSetting(ownerId, key)
  }
  return getSetting(key)
}
