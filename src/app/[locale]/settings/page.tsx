'use client'

import { useEffect, useState } from 'react'
import { CircleAlert, KeyRound, LoaderCircle } from 'lucide-react'
import { CAPABILITY_LABELS, ShareCapability, TTS_CAPABILITIES } from '@/lib/api-capabilities'
import { Platform } from '@/lib/podcast/types'

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
type ApiShare = { id: number; ownerUserId: number; recipientUserId: number; capability: ShareCapability;
  delegatedByUserId: number | null; parentShareId: number | null; allowReshare: boolean;
  maxEpisodes: number; usedEpisodes: number; active: boolean }
type Code = { id: number; label: string | null; usedCount: number; maxUses: number;
  dailyMaxUses: number | null; dailyUsedCount: number; dailyUsedOn: string | null;
  teamAccess: boolean; expiresAt: string | null }
const chinaToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const inviteState = (code: Code) => code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now()
  ? '已关闭' : code.usedCount >= code.maxUses ? '已用完' : `剩余 ${code.maxUses - code.usedCount} 次`
const accessText = (access?: { source: string; error?: string }) => !access ? '正在检查…' : access.error ||
  (access.source === 'own' ? '使用自己的 API' : access.source === 'member' ? '使用成员分享额度' : '使用管理员授权额度')

// 设置页的两个小件：分节标题、说明行
function SectionHeading({ title, description }: { title: string; description?: string }) {
  return <div className="flex flex-col gap-1">
    <h2 className="ys-title text-lg">{title}</h2>
    {description && <p className="text-sm text-ink-soft">{description}</p>}
  </div>
}
function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-ink-soft">{children}</p>
}

export default function SettingsPage() {
  const [admin, setAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [apiEnabled, setApiEnabled] = useState<Record<'llm' | 'tts', boolean>>({ llm: true, tts: true })
  const [savingToggle, setSavingToggle] = useState<'llm' | 'tts' | null>(null)
  const [access, setAccess] = useState<any>(null)
  const [ttsAccess, setTtsAccess] = useState<Record<string, { source: string; error?: string }> | null>(null)
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
  const [shareCapability, setShareCapability] = useState<ShareCapability>('llm')
  const [shareEpisodes, setShareEpisodes] = useState(3)
  const [shareLimits, setShareLimits] = useState<Record<number, number>>({})
  const [shareError, setShareError] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [codes, setCodes] = useState<Code[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState('')
  const [target, setTarget] = useState('')
  const [capability, setCapability] = useState<ShareCapability>('llm')
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
    const response = await fetch(me.isAdmin ? '/api/admin/settings' : '/api/user/settings?allTts=1')
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
    setTtsAccess(data.ttsAccess || null)
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
    setMessage(response.ok ? `已撤销 ${data.revoked} 个其他管理员会话，清理 ${data.purged ?? 0} 条过期记录；当前登录保留` : data.error || '撤销失败')
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

  const shell = 'mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8'

  if (!ready) return <main className={shell}>
    <h1 className="ys-title text-2xl sm:text-[28px]">模型与权限设置</h1>
    <p role="status" className="flex items-center gap-2 text-sm text-ink-soft"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />正在加载配置…</p>
    <div className="ys-sheet h-56 animate-pulse" />
  </main>

  return <main className={shell}>
    <header className="flex flex-col gap-1.5">
      <h1 className="ys-title text-2xl sm:text-[28px]">模型与权限设置</h1>
      <p className="max-w-3xl text-sm text-ink-soft">
        {admin ? '全局密钥仅供管理员及明确授权的成员使用。' : '你的密钥只保存在服务端，默认仅自己的任务使用；主动分享后，指定成员才能在额度内调用。私有配置优先于共享授权。'}
      </p>
    </header>

    {message && <p role="status" className="ys-note sticky top-[4.5rem] z-30 flex items-center gap-2 border border-rule bg-sheet text-ink shadow-bar">
      <CircleAlert className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />{message}
    </p>}

    {!admin && access && <section className="ys-sheet flex flex-col gap-3 p-5">
      <SectionHeading title="当前可用权限" />
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 rounded-control bg-paper px-3 py-2"><dt className="text-ink-soft">大模型</dt><dd className="text-right text-ink">{accessText(access.llm)}</dd></div>
        {Object.values(Platform).map(platform => <div key={platform} className="flex justify-between gap-3 rounded-control bg-paper px-3 py-2">
          <dt className="text-ink-soft">{CAPABILITY_LABELS[TTS_CAPABILITIES[platform]]}</dt><dd className="text-right text-ink">{accessText(ttsAccess?.[platform])}</dd>
        </div>)}
      </dl>
      <p className="text-xs text-ink-soft">按主题生成需要额外配置搜索模型；管理员授权按完整节目计数。</p>
    </section>}

    {!admin && <section className="ys-sheet flex flex-wrap items-end gap-3 p-5">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
        <span className="ys-label">显示名称</span>
        <input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={40} className="ys-field" />
      </label>
      <button onClick={saveProfile} className="ys-btn ys-btn-secondary">保存名称</button>
    </section>}

    <section className="ys-sheet flex flex-col gap-5 p-5 sm:p-6">
      <SectionHeading title={admin ? '全局 API' : '我的私有 API'} description={admin
        ? '停用后，你和获得共享授权的成员都不会使用这类全局 API；各成员自己的密钥不受影响。'
        : '可分别停用自己的大模型或语音密钥，密钥会保留；若有管理员共享授权，会自动改用共享额度。'} />
      <div className="grid gap-3 sm:grid-cols-2">{(['llm', 'tts'] as const).map(kind => <div key={kind}
        className="flex items-center justify-between gap-3 rounded-control border border-rule px-4 py-3">
        <span className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${apiEnabled[kind] ? 'bg-voice' : 'bg-rule-strong'}`} aria-hidden="true" />
          <strong className="text-ink">{kind === 'llm' ? '大模型' : 'MiniMax 语音'}</strong>
          <span className="text-ink-soft">{apiEnabled[kind] ? '已启用' : '已停用'}</span>
        </span>
        <button type="button" onClick={() => void toggleApi(kind)} disabled={savingToggle !== null}
          aria-label={`${apiEnabled[kind] ? '停用' : '启用'}${kind === 'llm' ? '大模型' : '语音'} API`}
          className="ys-btn-sm ys-btn-secondary">{savingToggle === kind ? '保存中…' : apiEnabled[kind] ? '停用' : '启用'}</button>
      </div>)}</div>
      <p className="text-xs text-ink-soft">密钥留空表示保留已有值。URL 只接受已接入服务的 HTTPS 地址。</p>
      <div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <label key={key} className="flex flex-col gap-1.5">
        <span className="ys-label flex items-center gap-1.5">{label}{configured[key] && <span className="ys-pill bg-voice-tint py-0 text-[11px] text-voice-deep">已配置</span>}</span>
        <div className="flex gap-1.5">
          <input type={secrets.has(key) ? 'password' : 'text'} value={values[key] || ''}
            onChange={event => setValues({ ...values, [key]: event.target.value })}
            placeholder={secrets.has(key) && configured[key] ? '留空则保留已有密钥' : ''}
            className="ys-field min-w-0" autoComplete="off" />
          {!admin && secrets.has(key) && configured[key] && <button type="button" onClick={() => clearSecret(key)}
            className="ys-btn ys-btn-danger px-3 text-xs">移除</button>}
        </div>
      </label>)}</div>
      <div><button onClick={save} className="ys-btn ys-btn-primary">保存配置</button></div>
    </section>

    <section className="ys-sheet flex flex-col gap-4 p-5 sm:p-6">
      <SectionHeading title="成员 API 分享" description="分享的是服务端调用额度，不显示或发送密钥明文。原持有人可开启转分享；上游暂停、额度用完或密钥停用时，下游也会停止。" />
      {shareError && <p role="alert" className="ys-note bg-alert-tint text-alert-deep">{shareError} <button onClick={loadShares} className="font-semibold underline">重试</button></p>}
      {!admin && <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1"><span className="ys-label">分享来源</span>
          <select aria-label="分享来源" value={shareSource} onChange={event => setShareSource(event.target.value)} className="ys-field-sm min-h-10 w-auto pr-8">
            <option value="">我的私有 API</option>
            {shares.filter(share => share.recipientUserId === currentUserId && share.capability === shareCapability && share.allowReshare && share.active && share.usedEpisodes < share.maxEpisodes)
              .map(share => <option key={share.id} value={share.id}>获准转分享 #{share.id}（剩余 {share.maxEpisodes - share.usedEpisodes} 期）</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="ys-label">分享给</span>
          <select aria-label="分享给成员" value={shareRecipient} onChange={event => setShareRecipient(event.target.value)} className="ys-field-sm min-h-10 w-auto pr-8">
            <option value="">选择接收成员</option>
            {shareUsers.filter(item => item.id !== currentUserId).map(item => <option key={item.id} value={item.id}>{item.displayName || `用户 #${item.id}`}</option>)}
          </select></label>
        <label className="flex flex-col gap-1"><span className="ys-label">能力</span>
          <select aria-label="分享能力" value={shareCapability} onChange={event => { setShareCapability(event.target.value as ShareCapability); setShareSource('') }}
            className="ys-field-sm min-h-10 w-auto pr-8">{Object.entries(CAPABILITY_LABELS).map(([key, label]) =>
              <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="flex flex-col gap-1"><span className="ys-label">总期数</span>
          <input type="number" min="1" max="1000" value={shareEpisodes}
            onChange={event => setShareEpisodes(Number(event.target.value))} className="ys-field-sm min-h-10 w-20" /></label>
        <button onClick={createShare} disabled={!shareRecipient} className="ys-btn ys-btn-primary min-h-10">分享额度</button>
      </div>}
      <div className="divide-y divide-rule text-sm">{shares.length === 0 && !shareError && <EmptyLine>暂无成员 API 分享</EmptyLine>}
        {shares.map(share => <div key={share.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <span className="text-ink">
            <strong>{shareUsers.find(item => item.id === share.delegatedByUserId)?.displayName || `用户 #${share.delegatedByUserId || share.ownerUserId}`}</strong>
            <span className="text-ink-soft"> 分享给 </span>
            <strong>{shareUsers.find(item => item.id === share.recipientUserId)?.displayName || `用户 #${share.recipientUserId}`}</strong>
            <span className="ml-2 text-ink-soft">{CAPABILITY_LABELS[share.capability] || share.capability}，已用 {share.usedEpisodes}/{share.maxEpisodes} 期</span>
            <span className={`ys-pill ml-2 ${share.active ? 'bg-voice-tint text-voice-deep' : 'bg-paper text-ink-soft'}`}>{share.active ? '启用' : '暂停'}</span>
            {share.parentShareId && <span className="ys-tag ml-1">来自分享 #{share.parentShareId}</span>}{share.allowReshare && <span className="ys-tag ml-1">可转分享</span>}
          </span>
          {(admin || share.ownerUserId === currentUserId || share.delegatedByUserId === currentUserId) && <div className="flex flex-wrap items-center gap-1.5">
            <input aria-label={`分享 #${share.id} 总期数`} type="number" min={share.usedEpisodes || 1} max="1000"
              value={shareLimits[share.id] ?? share.maxEpisodes}
              onChange={event => setShareLimits({ ...shareLimits, [share.id]: Number(event.target.value) })}
              className="ys-field-sm w-20" />
            <button onClick={() => updateShare(share)} className="ys-btn-sm ys-btn-secondary">保存额度</button>
            <button onClick={() => updateShare(share, !share.active)} className="ys-btn-sm ys-btn-secondary">{share.active ? '暂停' : '启用'}</button>
            {(admin || share.ownerUserId === currentUserId) && <button onClick={() => updateShare(share, share.active, !share.allowReshare)} className="ys-btn-sm ys-btn-secondary">
              {share.allowReshare ? '关闭转分享' : '允许转分享'}</button>}
          </div>}
        </div>)}
      </div>
    </section>

    {!admin && <section className="ys-sheet flex flex-col gap-4 p-5 sm:p-6">
      <SectionHeading title="个人登录码" description="更换设备或会话过期后，用个人登录码回到同一个账户及节目。" />
      <div><button onClick={renewLoginCode} className="ys-btn ys-btn-secondary"><KeyRound className="h-4 w-4" aria-hidden="true" />生成新登录码</button></div>
      {loginCode && <output className="ys-code tracking-wider">{loginCode}</output>}
    </section>}

    {admin && <>
      <section className="ys-sheet flex flex-wrap items-center justify-between gap-3 p-5">
        <SectionHeading title="管理员登录" description="保留当前浏览器的管理员会话，让其他管理员令牌失效。" />
        <button type="button" onClick={revokeOtherAdminSessions} className="ys-btn ys-btn-danger">撤销其他管理员登录</button>
      </section>
      {teamError && <p role="alert" className="ys-note bg-alert-tint text-alert-deep">
        {teamError} <button type="button" className="ml-2 font-semibold underline" onClick={() => void loadTeam()}>重试</button>
      </p>}
      <div className="grid gap-6 lg:grid-cols-2">
      <section className="ys-sheet flex flex-col gap-4 p-5 sm:p-6">
        <SectionHeading title="邀请码" description="体验用户只能看自己的内容；团队成员还能查看被明确共享到团队的节目。" />
        <div className="flex flex-col gap-2 sm:flex-row"><input placeholder="备注，例如：朋友 A" value={inviteLabel}
          onChange={event => setInviteLabel(event.target.value)} className="ys-field min-w-0 flex-1" />
          <button onClick={createInvite} className="ys-btn ys-btn-primary">生成邀请码</button></div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
          <label className="inline-flex items-center gap-2">总共可用<input type="number" min="1" max="1000" value={inviteMaxUses}
            onChange={event => setInviteMaxUses(Number(event.target.value))} className="ys-field-sm w-20" />次</label>
          <label className="inline-flex items-center gap-2">每日参考<input type="number" min="1" max="1000" placeholder="不设" value={inviteDailyMaxUses}
            onChange={event => setInviteDailyMaxUses(event.target.value === '' ? '' : Number(event.target.value))}
            className="ys-field-sm w-20" />次（仅提醒，不阻止兑换）</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={inviteTeamAccess}
            onChange={event => setInviteTeamAccess(event.target.checked)} className="rounded border-rule text-brand focus:ring-focus" />将受邀者加入团队</label>
        </div>
        {inviteCode && <output className="ys-code tracking-wider">{inviteCode}</output>}
        <div className="divide-y divide-rule rounded-control border border-rule px-3 text-sm">
          {teamLoading && codes.length === 0 && <EmptyLine>正在加载邀请码…</EmptyLine>}
          {!teamLoading && !teamError && codes.length === 0 && <EmptyLine>还没有邀请码</EmptyLine>}
          {codes.map(code => <div key={code.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><span className="font-medium text-ink">{code.label || `邀请码 #${code.id}`}</span>
              <p className="mt-1 text-xs text-ink-soft">{code.teamAccess ? '团队成员' : '体验用户'}，{inviteState(code)}，总计 {code.usedCount}/{code.maxUses} 次
                {code.dailyMaxUses ? `，今日 ${code.dailyUsedOn === chinaToday() ? code.dailyUsedCount : 0}/${code.dailyMaxUses} 次（参考）` : `，今日 ${code.dailyUsedOn === chinaToday() ? code.dailyUsedCount : 0} 次`}</p></div>
            <div className="flex gap-1.5"><button onClick={() => editInvite(code)} className="ys-btn-sm ys-btn-secondary">编辑</button>
              <button onClick={() => closeInvite(code.id)} className="ys-btn-sm ys-btn-secondary">关闭</button>
              {!users.some(user => user.inviteCodeId === code.id) && <button onClick={() => removeInvite(code.id)}
                className="ys-btn-sm ys-btn-danger">删除</button>}</div>
          </div>
          {editingInvite === code.id && <div className="mt-3 grid gap-3 rounded-control bg-paper p-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1"><span className="ys-label">备注</span><input value={inviteDraft.label} maxLength={120} onChange={event => setInviteDraft({ ...inviteDraft, label: event.target.value })}
              className="ys-field-sm" /></label>
            <label className="flex flex-col gap-1"><span className="ys-label">总共最多次数</span><input type="number" min={code.usedCount || 1} max={1000} value={inviteDraft.maxUses}
              onChange={event => setInviteDraft({ ...inviteDraft, maxUses: Number(event.target.value) })}
              className="ys-field-sm" /></label>
            <label className="flex flex-col gap-1"><span className="ys-label">每日参考次数（不限制兑换）</span><input type="number" min="1" max="1000" placeholder="不设" value={inviteDraft.dailyMaxUses}
              onChange={event => setInviteDraft({ ...inviteDraft, dailyMaxUses: event.target.value === '' ? '' : Number(event.target.value) })}
              className="ys-field-sm" /></label>
            <div className="flex flex-col gap-2 text-xs text-ink">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={inviteDraft.teamAccess}
                onChange={event => setInviteDraft({ ...inviteDraft, teamAccess: event.target.checked })} className="rounded border-rule text-brand focus:ring-focus" />新加入者可访问团队内容</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={inviteDraft.active}
                onChange={event => setInviteDraft({ ...inviteDraft, active: event.target.checked })} className="rounded border-rule text-brand focus:ring-focus" />允许继续使用</label>
            </div>
            <div className="flex gap-2"><button onClick={saveInvite} className="ys-btn-sm ys-btn-primary">保存</button>
              <button onClick={() => setEditingInvite(null)} className="ys-btn-sm ys-btn-secondary">取消</button></div>
          </div>}
        </div>)}
        </div>
      </section>
      <section className="ys-sheet flex flex-col gap-4 p-5 sm:p-6">
        <SectionHeading title="团队成员" description="旧邀请码和已有账号默认是体验用户；可在这里逐个加入团队。成员仅能管理自己的节目。" />
        <div className="divide-y divide-rule text-sm">
          {teamLoading && users.length === 0 && <EmptyLine>正在加载成员…</EmptyLine>}
          {!teamLoading && !teamError && users.length === 0 && <EmptyLine>还没有成员</EmptyLine>}
          {users.map(user => <div key={user.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-voice-tint text-sm font-bold text-voice-deep">{(user.displayName || '#').slice(0, 1)}</span>
              <div><span className="font-medium text-ink">{user.displayName || `用户 #${user.id}`}</span>
                <p className="mt-0.5 text-xs text-ink-soft">#{user.id}，{new Date(user.expiresAt).getTime() <= Date.now() ? '已撤销' : user.teamAccess ? '团队成员' : '体验用户'}
                  {user.inviteCodeId ? `，来自 ${codes.find(code => code.id === user.inviteCodeId)?.label || `邀请码 #${user.inviteCodeId}`}` : ''}</p></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => resetMemberLoginCode(user.id)} className="ys-btn-sm ys-btn-secondary">重置登录码</button>
              <button onClick={() => setTeamAccess(user.id, !user.teamAccess)} className="ys-btn-sm ys-btn-secondary">
                {user.teamAccess ? '移出团队' : '加入团队'}
              </button>
              <button onClick={() => removeMember(user.id)} className="ys-btn-sm ys-btn-danger">撤销访问</button>
            </div>
          </div>
          {memberRecovery?.userId === user.id && <output className="ys-code mt-3 border-warn bg-warn-tint text-xs text-warn-deep">
            {memberRecovery.code}
          </output>}
        </div>)}</div>
      </section>
      </div>
      <section className="ys-sheet flex flex-col gap-4 p-5 sm:p-6">
        <SectionHeading title="共享 API 授权" description="可指定邀请码或已加入的用户；每个语音平台单独授权，额度按节目计算。" />
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_6rem_auto]">
          <select aria-label="授权对象" value={target} onChange={event => setTarget(event.target.value)} className="ys-field min-w-0 pr-8">
            <option value="">选择用户或邀请码</option>
            {users.map(user => <option key={user.id} value={`user:${user.id}`}>用户 #{user.id} {user.displayName || ''}</option>)}
            {codes.map(code => <option key={code.id} value={`code:${code.id}`}>邀请码 #{code.id} {code.label || ''} · {code.teamAccess ? '团队' : '体验'} · {inviteState(code)}</option>)}
          </select>
          <select aria-label="能力" value={capability} onChange={event => setCapability(event.target.value as ShareCapability)} className="ys-field pr-8">
            {Object.entries(CAPABILITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <input aria-label="节目额度" type="number" min="1" max="1000" value={episodes}
            onChange={event => setEpisodes(Number(event.target.value))} className="ys-field" />
          <button onClick={grant} disabled={!target || teamLoading} className="ys-btn ys-btn-primary">授权</button>
        </div>
        <div className="divide-y divide-rule text-sm">
          {teamLoading && grants.length === 0 && <EmptyLine>正在加载授权…</EmptyLine>}
          {!teamLoading && !teamError && grants.length === 0 && <EmptyLine>尚未分配共享 API 额度</EmptyLine>}
          {grants.map(item => <div key={item.id} className="flex items-center justify-between gap-2 py-2.5">
          <span className="text-ink">{item.userId ? `用户 #${item.userId}` : `邀请码 #${item.inviteCodeId}`}<span className="text-ink-soft">，{CAPABILITY_LABELS[item.capability as ShareCapability] || item.capability}，{item.usedEpisodes}/{item.maxEpisodes} 期</span></span>
          <button onClick={() => revoke(item.id)} className="ys-btn-sm ys-btn-danger">撤销</button>
        </div>)}</div>
      </section>
    </>}
  </main>
}
