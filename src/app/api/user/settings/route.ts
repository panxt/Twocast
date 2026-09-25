import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { userApiSettingsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { getUserSettings, setUserSetting, SETTING_KEYS, SettingKey } from '@/lib/settings'
import { availableApiAccess } from '@/lib/api-access'

const SECRETS = new Set(['LLM_API_KEY', 'LLM_SEARCH_API_KEY', 'MINIMAX_TOKEN'])
const HOSTS = new Set(['api.minimaxi.com', 'api.minimax.io', 'api.openai.com',
  'openrouter.ai', 'api.deepseek.com', 'api.x.ai', 'api.moonshot.cn',
  'dashscope.aliyuncs.com', 'generativelanguage.googleapis.com'])

export async function GET() {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const values = await getUserSettings(user.userId, SETTING_KEYS)
  const settings: Record<string, string | boolean> = {}
  for (const key of SETTING_KEYS) {
    settings[key] = SECRETS.has(key) ? Boolean(values[key]) : values[key]
  }
  const access = await availableApiAccess(user, false)
  return NextResponse.json({ settings, access })
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  if (user.isAdmin) return NextResponse.json({ error: '管理员请使用全局 API 设置' }, { status: 403 })
  const input = await request.json().catch(() => null)
  if (!input || typeof input !== 'object') return NextResponse.json({ error: '配置无效' }, { status: 400 })
  const changes: { key: SettingKey; value: string | null }[] = []
  for (const key of Object.keys(input)) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) return NextResponse.json({ error: '未知配置项' }, { status: 400 })
    const value = input[key]
    if (key === 'API_LLM_ENABLED' || key === 'API_TTS_ENABLED') {
      if (value !== '0' && value !== '1') return NextResponse.json({ error: `${key} 只能启用或停用` }, { status: 400 })
      changes.push({ key, value })
      continue
    }
    if (value === null) {
      changes.push({ key: key as SettingKey, value: null })
      continue
    }
    if (typeof value !== 'string' || value.length > 2048) return NextResponse.json({ error: `${key} 格式无效` }, { status: 400 })
    const trimmed = value.trim()
    if (!trimmed && SECRETS.has(key)) continue
    if (key.endsWith('_URL') && trimmed) {
      try {
        const url = new URL(trimmed)
        if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.username || url.password) throw new Error()
      } catch { return NextResponse.json({ error: `${key} 仅支持已接入的 HTTPS 服务域名` }, { status: 400 }) }
    }
    changes.push({ key: key as SettingKey, value: trimmed || null })
  }
  for (const change of changes) {
    if (change.value === null) {
      await getDb().delete(userApiSettingsTable).where(and(
        eq(userApiSettingsTable.userId, user.userId), eq(userApiSettingsTable.key, change.key),
      ))
    } else await setUserSetting(user.userId, change.key, change.value)
  }
  return NextResponse.json({ ok: true })
}
