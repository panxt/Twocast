import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { getSetting, setSetting, SETTING_KEYS, SettingKey } from '@/lib/settings'

const SECRET_KEYS = new Set(['LLM_API_KEY', 'LLM_SEARCH_API_KEY', 'MINIMAX_TOKEN'])

export async function GET() {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const settings: Record<string, string | boolean> = {}
  for (const key of SETTING_KEYS) {
    const value = await getSetting(key)
    settings[key] = SECRET_KEYS.has(key) ? Boolean(value) : value
  }
  return NextResponse.json({ settings })
}

export async function PUT(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const input = await request.json().catch(() => null)
  if (!input || typeof input !== 'object') return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
  for (const key of SETTING_KEYS) {
    if (!(key in input)) continue
    const value = input[key]
    if (typeof value !== 'string' || value.length > 2048) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
    if (SECRET_KEYS.has(key) && !value.trim()) continue // blank means retain existing key
    if (key.endsWith('_URL')) {
      try { if (new URL(value).protocol !== 'https:') throw new Error() }
      catch { return NextResponse.json({ error: `${key} must be HTTPS` }, { status: 400 }) }
    }
    await setSetting(key as SettingKey, value.trim())
  }
  return NextResponse.json({ ok: true })
}
