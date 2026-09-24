import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { userApiSettingsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { getUserSetting, setUserSetting, SETTING_KEYS, SettingKey } from '@/lib/settings'
import { availableApiAccess } from '@/lib/api-access'

const SECRETS = new Set(['LLM_API_KEY', 'LLM_SEARCH_API_KEY', 'MINIMAX_TOKEN'])
const HOSTS = new Set(['api.minimaxi.com', 'api.minimax.io', 'api.openai.com',
  'openrouter.ai', 'api.deepseek.com', 'api.x.ai', 'api.moonshot.cn',
  'dashscope.aliyuncs.com', 'generativelanguage.googleapis.com'])

export async function GET() {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const settings: Record<string, string | boolean> = {}
  for (const key of SETTING_KEYS) {
    const value = await getUserSetting(user.userId, key)
    settings[key] = SECRETS.has(key) ? Boolean(value) : value
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
  for (const key of Object.keys(input)) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) return NextResponse.json({ error: '未知配置项' }, { status: 400 })
    const value = input[key]
    if (value === null) {
      await getDb().delete(userApiSettingsTable).where(and(eq(userApiSettingsTable.userId, user.userId), eq(userApiSettingsTable.key, key)))
      continue
    }
    if (typeof value !== 'string' || value.length > 2048) return NextResponse.json({ error: `${key} 格式无效` }, { status: 400 })
    if (!value.trim()) continue
    if (key.endsWith('_URL')) {
      try {
        const url = new URL(value)
        if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.username || url.password) throw new Error()
      } catch { return NextResponse.json({ error: `${key} 仅支持已接入的 HTTPS 服务域名` }, { status: 400 }) }
    }
    await setUserSetting(user.userId, key as SettingKey, value.trim())
  }
  return NextResponse.json({ ok: true })
}
