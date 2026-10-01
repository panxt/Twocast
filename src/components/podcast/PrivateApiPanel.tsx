'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
const fields = [
  ['LLM_CHAT_URL', '完整聊天接口 URL'],
  ['LLM_CHAT_MODEL', '聊天模型 ID'],
  ['LLM_API_KEY', '聊天 API Key'],
  ['MINIMAX_GROUP_ID', 'MiniMax Group ID'],
  ['MINIMAX_TOKEN', 'MiniMax API Key'],
  ['FISH_AUDIO_TOKEN', 'Fish Audio Key'],
  ['GEMINI_TTS_API_KEY', 'Gemini TTS Key'],
  ['ELEVENLABS_API_KEY', 'ElevenLabs Key'],
] as const
const secrets = new Set([
  'LLM_API_KEY',
  'MINIMAX_TOKEN',
  'FISH_AUDIO_TOKEN',
  'GEMINI_TTS_API_KEY',
  'ELEVENLABS_API_KEY',
])
export default function PrivateApiPanel() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [enabled, setEnabled] = useState({ llm: true, tts: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        const next: Record<string, string> = {}
        for (const [k] of fields) next[k] = typeof d.settings?.[k] === 'string' ? d.settings[k] : ''
        setValues(next)
        setConfigured(d.settings || {})
        setEnabled({
          llm: d.settings?.API_LLM_ENABLED !== '0',
          tts: d.settings?.API_TTS_ENABLED !== '0',
        })
      })
      .catch(() => {
        if (alive) setError('私有配置加载失败')
      })
    return () => {
      alive = false
    }
  }, [])
  return (
    <details className="ys-sheet p-5">
      <summary className="cursor-pointer font-semibold">我自己的私有 API（管理员也可使用）</summary>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (busy) return
          setBusy(true)
          try {
            const r = await fetch('/api/user/settings', {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                ...values,
                API_LLM_ENABLED: enabled.llm ? '1' : '0',
                API_TTS_ENABLED: enabled.tts ? '1' : '0',
              }),
            })
            const d = await r.json()
            if (!r.ok) throw new Error(d.error)
            toast.success('私有配置已保存')
          } catch (e) {
            setError(e instanceof Error ? e.message : '保存失败')
          } finally {
            setBusy(false)
          }
        }}
      >
        <p className="text-sm text-ink-soft">
          启用且配置完整时优先使用私有 Key。停用后不再调用此
          Key；有共享授权时可使用共享额度。密钥不会展示给其他成员，留空保留已有密钥。
        </p>
        {fields.map(([key, label]) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              className="ys-field"
              type={secrets.has(key) ? 'password' : 'text'}
              autoComplete="off"
              value={values[key] || ''}
              placeholder={secrets.has(key) && configured[key] ? '已配置，留空保留' : ''}
              maxLength={2048}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </label>
        ))}
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={enabled.llm}
            onChange={(e) => setEnabled((v) => ({ ...v, llm: e.target.checked }))}
          />
          启用我的聊天 API
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={enabled.tts}
            onChange={(e) => setEnabled((v) => ({ ...v, tts: e.target.checked }))}
          />
          启用我的 TTS API
        </label>
        {error && (
          <p role="alert" className="text-alert-deep">
            {error}
          </p>
        )}
        <button disabled={busy} className="ys-btn ys-btn-primary">
          保存私有配置
        </button>
      </form>
    </details>
  )
}
