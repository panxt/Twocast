import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { appSettingsTable } from '@/db/schema'

export const SETTING_KEYS = [
  'LLM_CHAT_URL', 'LLM_CHAT_MODEL', 'LLM_API_KEY',
  'LLM_SEARCH_URL', 'LLM_SEARCH_MODEL', 'LLM_SEARCH_API_KEY',
  'MINIMAX_GROUP_ID', 'MINIMAX_TOKEN',
] as const
export type SettingKey = typeof SETTING_KEYS[number]

function encryptionKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY || ''
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('SETTINGS_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  return key
}

function encrypt(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
}

function decrypt(value: string): string {
  const bytes = Buffer.from(value, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12))
  decipher.setAuthTag(bytes.subarray(12, 28))
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')
}

export async function getSetting(key: SettingKey): Promise<string> {
  const rows = await getDb().select().from(appSettingsTable).where(eq(appSettingsTable.key, key)).limit(1)
  return rows[0] ? decrypt(rows[0].encryptedValue) : (process.env[key] || '')
}

export async function setSetting(key: SettingKey, value: string) {
  await getDb().insert(appSettingsTable).values({ key, encryptedValue: encrypt(value), updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { encryptedValue: encrypt(value), updatedAt: new Date() } })
}
