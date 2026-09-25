import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
import { getSettings, setSetting, SETTING_KEYS, SettingKey } from '@/lib/settings'

const SECRET_KEYS = new Set(['LLM_API_KEY', 'LLM_SEARCH_API_KEY', 'MINIMAX_TOKEN'])

export async function GET() {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const values = await getSettings(SETTING_KEYS)
  const settings: Record<string, string | boolean> = {}
  for (const key of SETTING_KEYS) {
    settings[key] = SECRET_KEYS.has(key) ? Boolean(values[key]) : values[key]
  }
  return NextResponse.json({ settings })
}

export async function PUT(request: NextRequest) {
  if (!(await getCurrentUser()).isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const input = await request.json().catch(() => null)
  if (!input || typeof input !== 'object') return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
  const changes: { key: SettingKey; value: string }[] = []
  for (const key of SETTING_KEYS) {
    if (!(key in input)) continue
    const value = input[key]
    if (typeof value !== 'string' || value.length > 2048) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
    const trimmed = value.trim()
    if (SECRET_KEYS.has(key) && !trimmed) continue // blank means retain existing key
    if (key.endsWith('_URL') && trimmed) {
      try { if (new URL(trimmed).protocol !== 'https:') throw new Error() }
      catch { return NextResponse.json({ error: `${key} must be HTTPS` }, { status: 400 }) }
    }
    changes.push({ key, value: trimmed })
  }
  for (const change of changes) await setSetting(change.key, change.value)
  return NextResponse.json({ ok: true })
}
