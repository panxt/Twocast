'use client'

import { useEffect, useState } from 'react'

const fields = [
  ['LLM_CHAT_URL', '聊天接口 URL'], ['LLM_CHAT_MODEL', '聊天模型'], ['LLM_API_KEY', '聊天 API Key'],
  ['LLM_SEARCH_URL', '搜索接口 URL'], ['LLM_SEARCH_MODEL', '搜索模型'], ['LLM_SEARCH_API_KEY', '搜索 API Key'],
  ['MINIMAX_GROUP_ID', 'MiniMax Group ID'], ['MINIMAX_TOKEN', 'MiniMax TTS API Key'],
  ['FISH_AUDIO_TOKEN', 'Fish Audio API Key'], ['FISH_AUDIO_MODEL', 'Fish Audio 模型（默认 s2.1-pro-free）'],
  ['GEMINI_TTS_API_KEY', 'Gemini TTS API Key'], ['GEMINI_TTS_MODEL', 'Gemini TTS 模型（默认 gemini-3.8-flash-lite-tts）'],
] as const
const secrets = new Set(['LLM_API_KEY', 'LLM_SEARCH_API_KEY', 'MINIMAX_TOKEN', 'FISH_AUDIO_TOKEN', 'GEMINI_TTS_API_KEY'])
type Grant = { id: number; userId: number | null; inviteCodeId: number | null; capability: string; maxEpisodes: number; usedEpisodes: number }
type User = { id: number; displayName: string | null; inviteCodeId: number | null; teamAccess: boolean; expiresAt: string }
type ApiShare = { id: number; ownerUserId: number; recipientUserId: number; capability: 'llm' | 'tts';
  delegatedByUserId: number | null; parentShareId: number | null; allowReshare: boolean;
  maxEpisodes: number; usedEpisodes: number; active: boolean }
type Code = { id: number; label: string | null; usedCount: number; maxUses: number;
  dailyMaxUses: number | null; dailyUsedCount: number; dailyUsedOn: string | null;
  teamAccess: boolean; expiresAt: string | null }
const chinaToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const inviteState = (code: Code) => code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now()
  ? '已关闭' : code.usedCount >= code.maxUses ? '已用完' : `剩余 ${code.maxUses - code.usedCount} 次`

export default function SettingsPage() {
  const [admin, setAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [apiEnabled, setApiEnabled] = useState<Record<'llm' | 'tts', boolean>>({ llm: true, tts: true })
  const [savingToggle, setSavingToggle] = useState<'llm' | 'tts' | null>(null)
  const [access, setAccess] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [memberRecovery, setMemberRecovery] = useState<{ userId: number; code: string } | null>(null)
  const [inviteLabel, setInviteLabel] = useState('')
  const [inviteTeamAccess, setInviteTeamAccess] = useState(false)
  const [inviteMaxUses, setInviteMaxUses] = useState(1)
  const [inviteDailyMaxUses, setInviteDailyMaxUses] = useState<number | ''>('')
  const [editingInvite, setEditingInvite] = useState<number | null>(null)
  const [inviteDraft, setInviteDraft] = useState<{ label: string; maxUses: number; dailyMaxUses: number | ''; teamAccess: boolean; active: boolean }>({ label: '', maxUses: 1, dailyMaxUses: '', teamAccess: false, active: true })
  const [grants, setGrants] = useState<Grant[]>([])
  const [shares, setShares] = useState<ApiShare[]>([])
  const [shareUsers, setShareUsers] = useState<{ id: number; displayName: string | null }[]>([])
  const [currentUserId, setCurrentUserId] = useState(0)
  const [shareRecipient, setShareRecipient] = useState('')
  const [shareSource, setShareSource] = useState('')
  const [shareCapability, setShareCapability] = useState<'llm' | 'tts'>('llm')
  const [shareEpisodes, setShareEpisodes] = useState(3)
  const [shareLimits, setShareLimits] = useState<Record<number, number>>({})
  const [shareError, setShareError] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [codes, setCodes] = useState<Code[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState('')
  const [target, setTarget] = useState('')
  const [capability, setCapability] = useState('llm')
  const [episodes, setEpisodes] = useState(3)

  async function loadTeam() {
    setTeamLoading(true)
    setTeamError('')
    try {
      const response = await fetch('/api/admin/grants')
      if (!response.ok) throw new Error('团队资料加载失败，请刷新重试')
      const data = await response.json()
      setGrants(data.grants || [])
      setUsers(data.users || [])
      setCodes(data.codes || [])
    } catch (error) {
      setTeamError(error instanceof Error ? error.message : '团队资料加载失败')
    } finally { setTeamLoading(false) }
  }

  async function loadShares() {
    try {
      const response = await fetch('/api/user/api-shares')
      if (!response.ok) throw new Error('API 分享列表加载失败')
      const data = await response.json()
      setShares(data.shares || [])
      setShareUsers(data.users || [])
      setShareLimits(Object.fromEntries((data.shares || []).map((share: ApiShare) => [share.id, share.maxEpisodes])))
      setShareError('')
    } catch (error) { setShareError(error instanceof Error ? error.message : 'API 分享列表加载失败') }
  }

  async function load(refreshTeam = true) {
    const me = await fetch('/api/auth/me').then(response => response.json())
    setAdmin(Boolean(me.isAdmin))
    setCurrentUserId(me.userId || 0)
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
    setApiEnabled({ llm: data.settings.API_LLM_ENABLED !== '0', tts: data.settings.API_TTS_ENABLED !== '0' })
    setAccess(data.access || null)
    setReady(true)
    if (me.isAdmin && refreshTeam) void loadTeam()
    if (refreshTeam) void loadShares()
  }
  // Initial data is loaded once; later updates call load or loadTeam explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => { setMessage('配置加载失败'); setReady(true) }) }, [])

  async function save() {
    setMessage('保存中…')
    const response = await fetch(admin ? '/api/admin/settings' : '/api/user/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values),
    })
    const data = await response.json()
    setMessage(response.ok ? '已保存' : data.error || '保存失败')
    if (response.ok) await load(false)
  }
  async function clearSecret(key: string) {
    if (admin) return
    const response = await fetch('/api/user/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [key]: null }),
    })
    setMessage(response.ok ? '已移除私有密钥' : (await response.json()).error)
    if (response.ok) await load(false)
  }
  async function toggleApi(capability: 'llm' | 'tts') {
    const next = !apiEnabled[capability]
    const key = capability === 'llm' ? 'API_LLM_ENABLED' : 'API_TTS_ENABLED'
    setSavingToggle(capability)
    try {
      const response = await fetch(admin ? '/api/admin/settings' : '/api/user/settings', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [key]: next ? '1' : '0' }),
      })
      const data = await response.json()
      setMessage(response.ok ? `${capability === 'llm' ? '大模型' : '语音'} API 已${next ? '启用' : '停用'}` : data.error || '切换失败')
      if (response.ok) await load(false)
    } finally { setSavingToggle(null) }
  }
  async function createInvite() {
    const response = await fetch('/api/admin/invites', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ maxUses: inviteMaxUses, dailyMaxUses: inviteDailyMaxUses || null,
        label: inviteLabel, teamAccess: inviteTeamAccess }),
    })
    const data = await response.json()
    setInviteCode(response.ok ? data.code : '')
    setMessage(response.ok ? '请现在复制邀请码；之后无法再次查看明文。' : data.error || '创建失败')
    if (response.ok) await loadTeam()
  }
  async function closeInvite(id: number) {
    if (!window.confirm('关闭后，这个邀请码不能再用于加入。已加入的成员仍可登录。')) return
    const response = await fetch(`/api/admin/invites?id=${id}`, { method: 'DELETE' })
    const data = await response.json()
    setMessage(response.ok ? '邀请码已关闭' : data.error || '关闭失败')
    if (response.ok) await loadTeam()
  }
  function editInvite(code: Code) {
    setEditingInvite(code.id)
    setInviteDraft({ label: code.label || '', maxUses: code.maxUses, dailyMaxUses: code.dailyMaxUses || '', teamAccess: code.teamAccess,
      active: !code.expiresAt || new Date(code.expiresAt).getTime() > Date.now() })
  }
  async function saveInvite() {
    const response = await fetch('/api/admin/invites', { method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: editingInvite, ...inviteDraft }) })
    const data = await response.json()
    setMessage(response.ok ? '邀请码已更新' : data.error || '更新失败')
    if (response.ok) { setEditingInvite(null); await loadTeam() }
  }
  async function removeInvite(id: number) {
    if (!window.confirm('永久删除此邀请码及其共享 API 授权？此操作无法撤销。')) return
    const response = await fetch(`/api/admin/invites?id=${id}&remove=1`, { method: 'DELETE' })
    const data = await response.json()
    setMessage(response.ok ? '邀请码已删除' : data.error || '删除失败')
    if (response.ok) await loadTeam()
  }
  async function removeMember(id: number) {
    if (!window.confirm('撤销此成员的登录和 API 授权？没有节目的测试账号会被删除；已有节目会保留。')) return
    const response = await fetch(`/api/admin/members?id=${id}`, { method: 'DELETE' })
    const data = await response.json()
    setMessage(response.ok ? (data.retainedForTasks ? '成员访问已撤销，节目已保留' : '成员账号已删除') : data.error || '撤销失败')
    if (response.ok) await loadTeam()
  }
  async function revokeOtherAdminSessions() {
    if (!window.confirm('让除当前浏览器之外的所有管理员登录失效？当前管理员会话会保留。')) return
    const response = await fetch('/api/admin/sessions', { method: 'DELETE' })
    const data = await response.json()
    setMessage(response.ok ? `已撤销 ${data.revoked} 个其他管理员会话；当前登录保留` : data.error || '撤销失败')
  }
  async function createShare() {
    const response = await fetch('/api/user/api-shares', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        recipientUserId: Number(shareRecipient), capability: shareCapability, maxEpisodes: shareEpisodes,
        parentShareId: shareSource ? Number(shareSource) : null,
      }) })
    const data = await response.json()
    setMessage(response.ok ? '已分享调用额度；对方看不到你的密钥' : data.error || '分享失败')
    if (response.ok) await loadShares()
  }
  async function updateShare(share: ApiShare, active = share.active, allowReshare = share.allowReshare) {
    const response = await fetch('/api/user/api-shares', { method: 'PATCH',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        id: share.id, active, maxEpisodes: shareLimits[share.id],
        ...(admin || share.ownerUserId === currentUserId ? { allowReshare } : {}),
      }) })
    const data = await response.json()
    setMessage(response.ok ? '分享设置已更新' : data.error || '更新失败')
    if (response.ok) await loadShares()
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
    if (response.ok) await loadTeam()
  }
  async function revoke(id: number) {
    const response = await fetch(`/api/admin/grants?id=${id}`, { method: 'DELETE' })
    setMessage(response.ok ? '已撤销授权' : (await response.json()).error)
    if (response.ok) await loadTeam()
  }
  async function setTeamAccess(userId: number, teamAccess: boolean) {
    const response = await fetch('/api/admin/members', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, teamAccess }),
    })
    const data = await response.json()
    setMessage(response.ok ? (teamAccess ? '已加入团队' : '已改为体验用户') : data.error || '更新失败')
    if (response.ok) await loadTeam()
  }
  async function resetMemberLoginCode(userId: number) {
    const member = users.find(item => item.id === userId)
    if (!window.confirm(`为「${member?.displayName || `用户 #${userId}`}」生成新登录码？旧登录码会立即失效，请安全地把新码交给本人。`)) return
    const response = await fetch('/api/admin/members/login-code', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId }),
    })
    const data = await response.json()
    setMemberRecovery(response.ok ? { userId, code: data.code } : null)
    setMessage(response.ok ? '新登录码只显示这一次，请现在保存并交给该成员。' : data.error || '重置失败')
  }

  if (!ready) return <main className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
    <h1 className="text-3xl font-semibold">模型与权限设置</h1>
    <p role="status" className="text-sm text-gray-500">正在加载配置…</p>
    <div className="h-56 animate-pulse rounded-xl border bg-gray-50 dark:bg-gray-900" />
  </main>
  return <main className="mx-auto max-w-5xl space-y-8 p-6 sm:p-8">
    <header><h1 className="text-3xl font-semibold">模型与权限设置</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {admin ? '全局密钥仅供管理员及明确授权的成员使用。' : '你的密钥只保存在服务端，仅你的生成任务会使用。私有配置优先于管理员授权。'}
      </p></header>
    {!admin && access && <section className="rounded-xl border p-4 text-sm">
      <h2 className="font-semibold">当前可用权限</h2>
      {(['llm', 'tts'] as const).map(key => <p key={key} className="mt-2">
        {key === 'llm' ? '大模型' : '语音'}：{access[key]?.error || (access[key]?.source === 'own' ? '使用自己的 API'
          : access[key]?.source === 'member' ? '使用成员分享额度' : '使用管理员授权额度')}
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
      <p className="text-sm text-gray-600 dark:text-gray-400">{admin
        ? '停用后，你和获得共享授权的成员都不会使用这类全局 API；各成员自己的密钥不受影响。'
        : '可分别停用自己的大模型或语音密钥，密钥会保留；若有管理员共享授权，会自动改用共享额度。'}</p>
      <div className="grid gap-3 sm:grid-cols-2">{(['llm', 'tts'] as const).map(kind => <div key={kind}
        className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 dark:border-gray-700">
        <span className="text-sm"><strong>{kind === 'llm' ? '大模型' : 'MiniMax 语音'}</strong>
          <span className="ml-2 text-gray-500">{apiEnabled[kind] ? '已启用' : '已停用'}</span></span>
        <button type="button" onClick={() => void toggleApi(kind)} disabled={savingToggle !== null}
          aria-label={`${apiEnabled[kind] ? '停用' : '启用'}${kind === 'llm' ? '大模型' : '语音'} API`}
          className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">{savingToggle === kind ? '保存中…' : apiEnabled[kind] ? '停用' : '启用'}</button>
      </div>)}</div>
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
    <section className="space-y-3 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">成员 API 分享</h2>
      <p className="text-sm text-gray-500">分享的是服务端调用额度，不显示或发送密钥明文。原持有人可开启转分享；上游暂停、额度用完或密钥停用时，下游也会停止。</p>
      {shareError && <p role="alert" className="text-sm text-red-600">{shareError} <button onClick={loadShares} className="underline">重试</button></p>}
      {!admin && <div className="flex flex-wrap gap-2">
        <select aria-label="分享来源" value={shareSource} onChange={event => setShareSource(event.target.value)} className="rounded border px-2 py-2 dark:bg-gray-800">
          <option value="">我的私有 API</option>
          {shares.filter(share => share.recipientUserId === currentUserId && share.capability === shareCapability && share.allowReshare && share.active && share.usedEpisodes < share.maxEpisodes)
            .map(share => <option key={share.id} value={share.id}>获准转分享 #{share.id}（剩余 {share.maxEpisodes - share.usedEpisodes} 期）</option>)}
        </select>
        <select aria-label="分享给成员" value={shareRecipient} onChange={event => setShareRecipient(event.target.value)} className="rounded border px-2 py-2 dark:bg-gray-800">
          <option value="">选择接收成员</option>
          {shareUsers.filter(item => item.id !== currentUserId).map(item => <option key={item.id} value={item.id}>{item.displayName || `用户 #${item.id}`}</option>)}
        </select>
        <select aria-label="分享能力" value={shareCapability} onChange={event => { setShareCapability(event.target.value as 'llm' | 'tts'); setShareSource('') }}
          className="rounded border px-2 py-2 dark:bg-gray-800"><option value="llm">大模型</option><option value="tts">语音（已配置的平台）</option></select>
        <label className="text-sm">总期数<input type="number" min="1" max="1000" value={shareEpisodes}
          onChange={event => setShareEpisodes(Number(event.target.value))} className="ml-2 w-20 rounded border px-2 py-2 dark:bg-gray-800" /></label>
        <button onClick={createShare} disabled={!shareRecipient} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50">分享额度</button>
      </div>}
      <div className="divide-y text-sm dark:divide-gray-700">{shares.length === 0 && !shareError && <p className="py-2 text-gray-500">暂无成员 API 分享</p>}
        {shares.map(share => <div key={share.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <span>{shareUsers.find(item => item.id === share.delegatedByUserId)?.displayName || `用户 #${share.delegatedByUserId || share.ownerUserId}`} → {shareUsers.find(item => item.id === share.recipientUserId)?.displayName || `用户 #${share.recipientUserId}`}
            {' · '}{share.capability === 'llm' ? '大模型' : '语音'} · 已用 {share.usedEpisodes}/{share.maxEpisodes} 期 · {share.active ? '启用' : '暂停'}
            {share.parentShareId && ` · 来自分享 #${share.parentShareId}`}{share.allowReshare && ' · 可转分享'}</span>
          {(admin || share.ownerUserId === currentUserId || share.delegatedByUserId === currentUserId) && <div className="flex items-center gap-2">
            <input aria-label={`分享 #${share.id} 总期数`} type="number" min={share.usedEpisodes || 1} max="1000"
              value={shareLimits[share.id] ?? share.maxEpisodes}
              onChange={event => setShareLimits({ ...shareLimits, [share.id]: Number(event.target.value) })}
              className="w-20 rounded border px-2 py-1 dark:bg-gray-800" />
            <button onClick={() => updateShare(share)} className="rounded border px-2 py-1">保存额度</button>
            <button onClick={() => updateShare(share, !share.active)} className="rounded border px-2 py-1">{share.active ? '暂停' : '启用'}</button>
            {(admin || share.ownerUserId === currentUserId) && <button onClick={() => updateShare(share, share.active, !share.allowReshare)} className="rounded border px-2 py-1">
              {share.allowReshare ? '关闭转分享' : '允许转分享'}</button>}
          </div>}
        </div>)}
      </div>
    </section>
    {!admin && <section className="space-y-3 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">个人登录码</h2>
      <p className="text-sm text-gray-500">更换设备或会话过期后，用个人登录码恢复同一个账户及文件。</p>
      <button onClick={renewLoginCode} className="rounded border px-4 py-2 text-sm">生成新登录码</button>
      {loginCode && <output className="block break-all rounded bg-gray-100 p-3 font-mono dark:bg-gray-800">{loginCode}</output>}
    </section>}
    {admin && <>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5">
        <div><h2 className="font-semibold">管理员登录</h2>
          <p className="mt-1 text-sm text-gray-500">保留当前浏览器的管理员会话，让其他管理员令牌失效。</p></div>
        <button type="button" onClick={revokeOtherAdminSessions} className="rounded border border-red-200 px-3 py-2 text-sm text-red-700">撤销其他管理员登录</button>
      </section>
      {teamError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {teamError} <button type="button" className="ml-2 underline" onClick={() => void loadTeam()}>重试</button>
      </p>}
      <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">邀请码</h2>
        <p className="text-sm text-gray-500">体验用户只能看自己的内容；团队成员还能查看被明确共享到团队的节目。</p>
        <div className="flex flex-col gap-2 sm:flex-row"><input placeholder="备注，例如：朋友 A" value={inviteLabel}
          onChange={event => setInviteLabel(event.target.value)} className="min-w-0 flex-1 rounded border px-3 py-2 dark:bg-gray-800" />
          <button onClick={createInvite} className="whitespace-nowrap rounded bg-indigo-600 px-4 py-2 text-white">生成邀请码</button></div>
        <div className="flex flex-wrap gap-3 text-sm">
          <label>总共可用<input type="number" min="1" max="1000" value={inviteMaxUses}
            onChange={event => setInviteMaxUses(Number(event.target.value))} className="ml-2 w-20 rounded border px-2 py-1 dark:bg-gray-800" />次</label>
          <label>每日参考<input type="number" min="1" max="1000" placeholder="不设" value={inviteDailyMaxUses}
            onChange={event => setInviteDailyMaxUses(event.target.value === '' ? '' : Number(event.target.value))}
            className="ml-2 w-20 rounded border px-2 py-1 dark:bg-gray-800" />次（仅提醒，不阻止兑换）</label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inviteTeamAccess}
          onChange={event => setInviteTeamAccess(event.target.checked)} />将受邀者加入团队</label>
        {inviteCode && <output className="block break-all rounded bg-gray-100 p-3 font-mono dark:bg-gray-800">{inviteCode}</output>}
        <div className="divide-y rounded-lg border px-3 text-sm dark:divide-gray-700 dark:border-gray-700">
          {teamLoading && codes.length === 0 && <p className="py-3 text-gray-500">正在加载邀请码…</p>}
          {!teamLoading && !teamError && codes.length === 0 && <p className="py-3 text-gray-500">还没有邀请码</p>}
          {codes.map(code => <div key={code.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><span className="font-medium">{code.label || `邀请码 #${code.id}`}</span>
              <p className="mt-1 text-xs text-gray-500">{code.teamAccess ? '团队成员' : '体验用户'} · {inviteState(code)} · 总计 {code.usedCount}/{code.maxUses} 次
                {code.dailyMaxUses ? ` · 今日 ${code.dailyUsedOn === chinaToday() ? code.dailyUsedCount : 0}/${code.dailyMaxUses} 次（参考）` : ` · 今日 ${code.dailyUsedOn === chinaToday() ? code.dailyUsedCount : 0} 次`}</p></div>
            <div className="flex gap-2"><button onClick={() => editInvite(code)} className="rounded border px-3 py-1.5 text-xs">编辑</button>
              <button onClick={() => closeInvite(code.id)} className="rounded border px-3 py-1.5 text-xs">关闭</button>
              {!users.some(user => user.inviteCodeId === code.id) && <button onClick={() => removeInvite(code.id)}
                className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-700">删除</button>}</div>
          </div>
          {editingInvite === code.id && <div className="mt-3 grid gap-2 rounded bg-gray-50 p-3 dark:bg-gray-900 sm:grid-cols-2">
            <label className="text-xs">备注<input value={inviteDraft.label} maxLength={120} onChange={event => setInviteDraft({ ...inviteDraft, label: event.target.value })}
              className="mt-1 w-full rounded border px-2 py-1.5 dark:bg-gray-800" /></label>
            <label className="text-xs">总共最多次数<input type="number" min={code.usedCount || 1} max={1000} value={inviteDraft.maxUses}
              onChange={event => setInviteDraft({ ...inviteDraft, maxUses: Number(event.target.value) })}
              className="mt-1 w-full rounded border px-2 py-1.5 dark:bg-gray-800" /></label>
            <label className="text-xs">每日参考次数（不限制兑换）<input type="number" min="1" max="1000" placeholder="不设" value={inviteDraft.dailyMaxUses}
              onChange={event => setInviteDraft({ ...inviteDraft, dailyMaxUses: event.target.value === '' ? '' : Number(event.target.value) })}
              className="mt-1 w-full rounded border px-2 py-1.5 dark:bg-gray-800" /></label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={inviteDraft.teamAccess}
              onChange={event => setInviteDraft({ ...inviteDraft, teamAccess: event.target.checked })} />新加入者可访问团队内容</label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={inviteDraft.active}
              onChange={event => setInviteDraft({ ...inviteDraft, active: event.target.checked })} />允许继续使用</label>
            <div className="flex gap-2"><button onClick={saveInvite} className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white">保存</button>
              <button onClick={() => setEditingInvite(null)} className="rounded border px-3 py-1.5 text-xs">取消</button></div>
          </div>}
        </div>)}
        </div>
      </section>
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">团队成员</h2>
        <p className="text-sm text-gray-500">旧邀请码和已有账号默认是体验用户；可在这里逐个加入团队。成员仅能管理自己的节目。</p>
        <div className="divide-y text-sm dark:divide-gray-700">
          {teamLoading && users.length === 0 && <p className="py-3 text-gray-500">正在加载成员…</p>}
          {!teamLoading && !teamError && users.length === 0 && <p className="py-3 text-gray-500">还没有成员</p>}
          {users.map(user => <div key={user.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><span className="font-medium">{user.displayName || `用户 #${user.id}`}</span>
              <p className="mt-1 text-xs text-gray-500">#{user.id} · {new Date(user.expiresAt).getTime() <= Date.now() ? '已撤销' : user.teamAccess ? '团队成员' : '体验用户'}
                {user.inviteCodeId ? ` · 来自 ${codes.find(code => code.id === user.inviteCodeId)?.label || `邀请码 #${user.inviteCodeId}`}` : ''}</p></div>
            <div className="flex gap-2">
              <button onClick={() => resetMemberLoginCode(user.id)} className="rounded border px-3 py-1.5 text-xs">重置登录码</button>
              <button onClick={() => setTeamAccess(user.id, !user.teamAccess)} className="rounded border px-3 py-1.5 text-xs">
                {user.teamAccess ? '移出团队' : '加入团队'}
              </button>
              <button onClick={() => removeMember(user.id)} className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-700">撤销访问</button>
            </div>
          </div>
          {memberRecovery?.userId === user.id && <output className="mt-3 block break-all rounded bg-amber-50 p-3 font-mono text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            {memberRecovery.code}
          </output>}
        </div>)}</div>
      </section>
      </div>
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">共享 API 授权</h2>
        <p className="text-sm text-gray-500">可指定邀请码或已加入的用户；大模型与语音分别授权，额度按节目计算。</p>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_6rem_6rem]">
          <select aria-label="授权对象" value={target} onChange={event => setTarget(event.target.value)} className="min-w-0 rounded border px-2 py-2 dark:bg-gray-800">
            <option value="">选择用户或邀请码</option>
            {users.map(user => <option key={user.id} value={`user:${user.id}`}>用户 #{user.id} {user.displayName || ''}</option>)}
            {codes.map(code => <option key={code.id} value={`code:${code.id}`}>邀请码 #{code.id} {code.label || ''} · {code.teamAccess ? '团队' : '体验'} · {inviteState(code)}</option>)}
          </select>
          <select aria-label="能力" value={capability} onChange={event => setCapability(event.target.value)} className="rounded border px-2 py-2 dark:bg-gray-800">
            <option value="llm">大模型</option><option value="tts">语音</option></select>
          <input aria-label="节目额度" type="number" min="1" max="1000" value={episodes}
            onChange={event => setEpisodes(Number(event.target.value))} className="rounded border px-2 py-2 dark:bg-gray-800" />
          <button onClick={grant} disabled={!target || teamLoading} className="whitespace-nowrap rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-40">授权</button>
        </div>
        <div className="divide-y text-sm">
          {teamLoading && grants.length === 0 && <p className="py-3 text-gray-500">正在加载授权…</p>}
          {!teamLoading && !teamError && grants.length === 0 && <p className="py-3 text-gray-500">尚未分配共享 API 额度</p>}
          {grants.map(item => <div key={item.id} className="flex items-center justify-between gap-2 py-2">
          <span>{item.userId ? `用户 #${item.userId}` : `邀请码 #${item.inviteCodeId}`} · {item.capability === 'llm' ? '大模型' : '语音'} · {item.usedEpisodes}/{item.maxEpisodes} 期</span>
          <button onClick={() => revoke(item.id)} className="text-red-600">撤销</button>
        </div>)}</div>
      </section>
    </>}
    {message && <p role="status" className="rounded border p-3 text-sm">{message}</p>}
  </main>
}
