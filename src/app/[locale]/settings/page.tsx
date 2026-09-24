'use client'

import { useEffect, useState } from 'react'

const fields = [
  ['LLM_CHAT_URL', '聊天接口 URL'], ['LLM_CHAT_MODEL', '聊天模型'], ['LLM_API_KEY', '聊天 API Key'],
  ['LLM_SEARCH_URL', '搜索接口 URL'], ['LLM_SEARCH_MODEL', '搜索模型'], ['LLM_SEARCH_API_KEY', '搜索 API Key'],
  ['MINIMAX_GROUP_ID', 'MiniMax Group ID'], ['MINIMAX_TOKEN', 'MiniMax TTS API Key'],
] as const
const secrets = new Set(['LLM_API_KEY', 'LLM_SEARCH_API_KEY', 'MINIMAX_TOKEN'])
type Grant = { id: number; userId: number | null; inviteCodeId: number | null; capability: string; maxEpisodes: number; usedEpisodes: number }
type User = { id: number; displayName: string | null; inviteCodeId: number | null }
type Code = { id: number; label: string | null; usedCount: number; maxUses: number }

export default function SettingsPage() {
  const [admin, setAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [access, setAccess] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [inviteLabel, setInviteLabel] = useState('')
  const [grants, setGrants] = useState<Grant[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [codes, setCodes] = useState<Code[]>([])
  const [target, setTarget] = useState('')
  const [capability, setCapability] = useState('llm')
  const [episodes, setEpisodes] = useState(3)

  async function load() {
    const me = await fetch('/api/auth/me').then(response => response.json())
    setAdmin(Boolean(me.isAdmin))
    setDisplayName(me.displayName || '')
    const response = await fetch(me.isAdmin ? '/api/admin/settings' : '/api/user/settings')
    if (!response.ok) { setMessage('请先登录'); setReady(true); return }
    const data = await response.json()
    const next: Record<string, string> = {}
    const flags: Record<string, boolean> = {}
    for (const [key] of fields) {
      if (secrets.has(key)) flags[key] = Boolean(data.settings[key])
      else next[key] = data.settings[key] || ''
    }
    setValues(next)
    setConfigured(flags)
    setAccess(data.access || null)
    if (me.isAdmin) {
      const grantsData = await fetch('/api/admin/grants').then(response => response.json())
      setGrants(grantsData.grants || [])
      setUsers(grantsData.users || [])
      setCodes(grantsData.codes || [])
    }
    setReady(true)
  }
  useEffect(() => { load().catch(() => { setMessage('配置加载失败'); setReady(true) }) }, [])

  async function save() {
    setMessage('保存中…')
    const response = await fetch(admin ? '/api/admin/settings' : '/api/user/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values),
    })
    const data = await response.json()
    setMessage(response.ok ? '已保存' : data.error || '保存失败')
    if (response.ok) await load()
  }
  async function clearSecret(key: string) {
    if (admin) return
    const response = await fetch('/api/user/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [key]: null }),
    })
    setMessage(response.ok ? '已移除私有密钥' : (await response.json()).error)
    if (response.ok) await load()
  }
  async function createInvite() {
    const response = await fetch('/api/admin/invites', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ maxUses: 1, label: inviteLabel }),
    })
    const data = await response.json()
    setInviteCode(response.ok ? data.code : '')
    setMessage(response.ok ? '请现在复制邀请码；之后无法再次查看明文。' : data.error || '创建失败')
    if (response.ok) await load()
  }
  async function renewLoginCode() {
    const response = await fetch('/api/user/login-code', { method: 'POST' })
    const data = await response.json()
    setLoginCode(response.ok ? data.code : '')
    setMessage(response.ok ? '请保存新的个人登录码；旧码已失效。' : data.error || '生成失败')
  }
  async function saveProfile() {
    const response = await fetch('/api/user/profile', { method: 'PATCH',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName }) })
    setMessage(response.ok ? '昵称已保存' : (await response.json()).error || '保存失败')
  }
  async function grant() {
    const [kind, idString] = target.split(':')
    const id = Number(idString)
    const response = await fetch('/api/admin/grants', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capability, maxEpisodes: episodes,
        userId: kind === 'user' ? id : null, inviteCodeId: kind === 'code' ? id : null }),
    })
    const data = await response.json()
    setMessage(response.ok ? '授权已添加' : data.error || '授权失败')
    if (response.ok) await load()
  }
  async function revoke(id: number) {
    const response = await fetch(`/api/admin/grants?id=${id}`, { method: 'DELETE' })
    setMessage(response.ok ? '已撤销授权' : (await response.json()).error)
    if (response.ok) await load()
  }

  if (!ready) return <main className="mx-auto max-w-3xl p-8">正在加载…</main>
  return <main className="mx-auto max-w-3xl space-y-8 p-6 sm:p-8">
    <header><h1 className="text-3xl font-semibold">模型与权限设置</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {admin ? '全局密钥仅供管理员及明确授权的体验用户使用。' : '你的密钥只保存在服务端，仅你的生成任务会使用。私有配置优先于管理员授权。'}
      </p></header>
    {!admin && access && <section className="rounded-xl border p-4 text-sm">
      <h2 className="font-semibold">当前可用权限</h2>
      {(['llm', 'tts'] as const).map(key => <p key={key} className="mt-2">
        {key === 'llm' ? '大模型' : '语音'}：{access[key]?.error || (access[key]?.source === 'own' ? '使用自己的 API' : '使用管理员授权额度')}
      </p>)}
      <p className="mt-2 text-gray-500">按主题生成需要额外配置搜索模型；管理员授权按完整节目计数。</p>
    </section>}
    {!admin && <section className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
      <label className="flex-1 text-sm">显示名称<input value={displayName} onChange={event => setDisplayName(event.target.value)}
        maxLength={40} className="mt-1 block w-full rounded border px-3 py-2 dark:bg-gray-800" /></label>
      <button onClick={saveProfile} className="rounded border px-4 py-2 text-sm">保存名称</button>
    </section>}
    <section className="space-y-4 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">{admin ? '全局 API' : '我的私有 API'}</h2>
      <p className="text-xs text-gray-500">密钥留空表示保留已有值。URL 只接受已接入服务的 HTTPS 地址。</p>
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="block">
        <span className="block text-sm font-medium">{label}{configured[key] ? '（已配置）' : ''}</span>
        <div className="mt-1 flex gap-1"><input type={secrets.has(key) ? 'password' : 'text'} value={values[key] || ''}
          onChange={event => setValues({ ...values, [key]: event.target.value })}
          className="w-full min-w-0 rounded-lg border px-3 py-2 text-sm dark:bg-gray-800" autoComplete="off" />
          {!admin && secrets.has(key) && configured[key] && <button type="button" onClick={() => clearSecret(key)}
            className="rounded border px-2 text-xs text-red-600">移除</button>}
        </div>
      </label>)}</div>
      <button onClick={save} className="rounded-lg bg-indigo-600 px-5 py-2 text-white">保存配置</button>
    </section>
    {!admin && <section className="space-y-3 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">个人登录码</h2>
      <p className="text-sm text-gray-500">更换设备或会话过期后，用个人登录码恢复同一个账户及文件。</p>
      <button onClick={renewLoginCode} className="rounded border px-4 py-2 text-sm">生成新登录码</button>
      {loginCode && <output className="block break-all rounded bg-gray-100 p-3 font-mono dark:bg-gray-800">{loginCode}</output>}
    </section>}
    {admin && <>
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">邀请码</h2>
        <div className="flex gap-2"><input placeholder="备注，例如：朋友 A" value={inviteLabel}
          onChange={event => setInviteLabel(event.target.value)} className="min-w-0 flex-1 rounded border px-3 py-2 dark:bg-gray-800" />
          <button onClick={createInvite} className="rounded bg-indigo-600 px-4 py-2 text-white">生成单次邀请码</button></div>
        {inviteCode && <output className="block break-all rounded bg-gray-100 p-3 font-mono dark:bg-gray-800">{inviteCode}</output>}
      </section>
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">共享 API 授权</h2>
        <p className="text-sm text-gray-500">可指定邀请码或已加入的用户；大模型与语音分别授权，额度按节目计算。</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem_6rem_auto]">
          <select aria-label="授权对象" value={target} onChange={event => setTarget(event.target.value)} className="rounded border px-2 py-2 dark:bg-gray-800">
            <option value="">选择用户或邀请码</option>
            {users.map(user => <option key={user.id} value={`user:${user.id}`}>用户 #{user.id} {user.displayName || ''}</option>)}
            {codes.map(code => <option key={code.id} value={`code:${code.id}`}>邀请码 #{code.id} {code.label || ''}</option>)}
          </select>
          <select aria-label="能力" value={capability} onChange={event => setCapability(event.target.value)} className="rounded border px-2 py-2 dark:bg-gray-800">
            <option value="llm">大模型</option><option value="tts">语音</option></select>
          <input aria-label="节目额度" type="number" min="1" max="1000" value={episodes}
            onChange={event => setEpisodes(Number(event.target.value))} className="rounded border px-2 py-2 dark:bg-gray-800" />
          <button onClick={grant} disabled={!target} className="rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-40">授权</button>
        </div>
        <div className="divide-y text-sm">{grants.map(item => <div key={item.id} className="flex items-center justify-between gap-2 py-2">
          <span>{item.userId ? `用户 #${item.userId}` : `邀请码 #${item.inviteCodeId}`} · {item.capability === 'llm' ? '大模型' : '语音'} · {item.usedEpisodes}/{item.maxEpisodes} 期</span>
          <button onClick={() => revoke(item.id)} className="text-red-600">撤销</button>
        </div>)}</div>
      </section>
    </>}
    {message && <p role="status" className="rounded border p-3 text-sm">{message}</p>}
  </main>
}
