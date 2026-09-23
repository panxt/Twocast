'use client'

import { useEffect, useState } from 'react'

const fields = [
  ['LLM_CHAT_URL', '聊天接口 URL'], ['LLM_CHAT_MODEL', '聊天模型'], ['LLM_API_KEY', '聊天 API Key'],
  ['LLM_SEARCH_URL', '搜索接口 URL'], ['LLM_SEARCH_MODEL', '搜索模型'], ['LLM_SEARCH_API_KEY', '搜索 API Key'],
  ['MINIMAX_GROUP_ID', 'MiniMax Group ID'], ['MINIMAX_TOKEN', 'MiniMax TTS API Key'],
] as const
const secrets = new Set(['LLM_API_KEY', 'LLM_SEARCH_API_KEY', 'MINIMAX_TOKEN'])

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings').then(async response => {
      if (!response.ok) { setForbidden(true); return }
      const { settings } = await response.json()
      const next: Record<string, string> = {}
      const flags: Record<string, boolean> = {}
      for (const [key] of fields) {
        if (secrets.has(key)) flags[key] = Boolean(settings[key])
        else next[key] = settings[key] || ''
      }
      setValues(next)
      setConfigured(flags)
    })
  }, [])

  async function save() {
    setMessage('保存中…')
    const response = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values),
    })
    setMessage(response.ok ? '已保存' : (await response.json()).error || '保存失败')
  }

  async function createInvite() {
    const response = await fetch('/api/admin/invites', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxUses: 1 }),
    })
    const data = await response.json()
    setInviteCode(response.ok ? data.code : '')
    setMessage(response.ok ? '请现在复制邀请码；之后无法再次查看明文。' : data.error || '创建失败')
  }

  if (forbidden) return <main className="mx-auto max-w-lg p-8">仅管理员可访问设置。</main>
  return <main className="mx-auto max-w-2xl space-y-8 p-8">
    <h1 className="text-3xl font-bold">Twocast 设置</h1>
    <p>API Key 只保存在服务端。密钥字段留空表示保留现有值。</p>
    <div className="space-y-4">{fields.map(([key, label]) => <label key={key} className="block">
      <span className="block font-medium">{label}{configured[key] ? '（已配置）' : ''}</span>
      <input type={secrets.has(key) ? 'password' : 'text'} value={values[key] || ''}
        onChange={event => setValues({ ...values, [key]: event.target.value })}
        className="mt-1 w-full rounded-lg border px-3 py-2 dark:bg-gray-800" autoComplete="off" />
    </label>)}</div>
    <button onClick={save} className="rounded-lg bg-indigo-600 px-5 py-2 text-white">保存模型配置</button>
    <hr />
    <h2 className="text-2xl font-semibold">邀请码</h2>
    <button onClick={createInvite} className="rounded-lg bg-indigo-600 px-5 py-2 text-white">生成单次邀请码</button>
    {inviteCode && <output className="block break-all rounded-lg border p-4 font-mono">{inviteCode}</output>}
    {message && <p role="status">{message}</p>}
  </main>
}
