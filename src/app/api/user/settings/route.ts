import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { userApiSettingsTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
import { getUserSettings, setUserSetting, SETTING_KEYS, SettingKey } from '@/lib/settings'
import { availableApiAccess, availableTtsAccess } from '@/lib/api-access'
import { Platform } from '@/lib/podcast/types'

const SECRETS = new Set(['LLM_API_KEY', 'LLM_SEARCH_API_KEY', 'MINIMAX_TOKEN', 'FISH_AUDIO_TOKEN', 'GEMINI_TTS_API_KEY'])
const HOSTS = new Set(['api.minimaxi.com', 'api.minimax.io', 'api.openai.com',
  'openrouter.ai', 'api.deepseek.com', 'api.x.ai', 'api.moonshot.cn',
  'dashscope.aliyuncs.com', 'generativelanguage.googleapis.com'])

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user.userEmail) return NextResponse.json({ error: '请先登录' }, { status: 401 })
  const values = await getUserSettings(user.userId, SETTING_KEYS)
  const settings: Record<string, string | boolean> = {}
  for (const key of SETTING_KEYS) {
    settings[key] = SECRETS.has(key) ? Boolean(values[key]) : values[key]
  }
  const requestedPlatform = request.nextUrl.searchParams.get('platform')
  const platform = Object.values(Platform).includes(requestedPlatform as Platform)
    ? requestedPlatform as Platform : Platform.Minimax
  const access = await availableApiAccess(user, false, platform)
  let ttsAccess: Record<string, Awaited<ReturnType<typeof availableTtsAccess>>> | undefined
  if (request.nextUrl.searchParams.get('allTts') === '1') {
    const others = Object.values(Platform).filter(item => item !== platform)
    const results = await Promise.all(others.map(item => availableTtsAccess(user, item)))
    ttsAccess = { [platform]: access.tts, ...Object.fromEntries(others.map((item, index) => [item, results[index]])) }
  }
  return NextResponse.json({ settings, access, ttsAccess })
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
    if (key === 'FISH_AUDIO_MODEL' && trimmed && !['s1', 's2-pro', 's2.1-pro', 's2.1-pro-free'].includes(trimmed)) {
      return NextResponse.json({ error: '不支持的 Fish Audio 模型' }, { status: 400 })
    }
    if (key === 'GEMINI_TTS_MODEL' && trimmed && !['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'].includes(trimmed)) {
      return NextResponse.json({ error: '不支持的 Gemini TTS 模型' }, { status: 400 })
    }
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
