'use client'

import { useEffect, useState } from 'react'
import { CircleAlert, KeyRound, LoaderCircle } from 'lucide-react'
import { CAPABILITY_LABELS, ShareCapability, TTS_CAPABILITIES } from '@/lib/api-capabilities'
import { Platform } from '@/lib/podcast/types'
import { useParams } from 'next/navigation'
import { getLocalePath } from '@/utils/locale-util'
import type { LocaleTypes } from '@/i18n/settings'
import { MODEL_FIELD_HELP, ModelConfigGuide } from '@/components/podcast/ModelConfigGuide'
import TranscriptFallbackPanel from '@/components/podcast/TranscriptFallbackPanel'
import FeishuLogin from '@/components/podcast/FeishuLogin'
import { UsageGuide } from '@/components/podcast/UsageGuide'

const fields = [
  ['LLM_CHAT_URL', '聊天接口 URL'],
  ['LLM_CHAT_MODEL', '聊天模型'],
  ['LLM_API_KEY', '聊天 API Key'],
  ['LLM_SEARCH_URL', '搜索接口 URL'],
  ['LLM_SEARCH_MODEL', '搜索模型'],
  ['LLM_SEARCH_API_KEY', '搜索 API Key'],
  ['MINIMAX_GROUP_ID', 'MiniMax Group ID'],
  ['MINIMAX_TOKEN', 'MiniMax API Key（语音与封面共用）'],
  ['ELEVENLABS_API_KEY', 'ElevenLabs API Key'],
  ['ELEVENLABS_MODEL', 'ElevenLabs 模型（默认 eleven_multilingual_v2）'],
  ['FISH_AUDIO_TOKEN', 'Fish Audio API Key'],
  ['FISH_AUDIO_MODEL', 'Fish Audio 模型（默认 s2.1-pro-free）'],
  ['GEMINI_TTS_API_KEY', 'Gemini TTS API Key'],
  ['GEMINI_TTS_MODEL', 'Gemini TTS 模型（默认 gemini-3.8-flash-lite-tts）'],
  ['GEMINI_IMAGE_MODEL', 'Gemini 封面图片模型（可选；默认 gemini-2.5-flash-image）'],
] as const
const secrets = new Set([
  'ELEVENLABS_API_KEY',
  'LLM_API_KEY',
  'LLM_SEARCH_API_KEY',
  'MINIMAX_TOKEN',
  'FISH_AUDIO_TOKEN',
  'GEMINI_TTS_API_KEY',
])
type Grant = {
  id: number
  userId: number | null
  inviteCodeId: number | null
  capability: string
  maxEpisodes: number
  usedEpisodes: number
}
type User = {
  id: number
  displayName: string | null
  inviteCodeId: number | null
  teamAccess: boolean
  expiresAt: string
}
type ApiShare = {
  id: number
  ownerUserId: number
  recipientUserId: number
  capability: ShareCapability
  delegatedByUserId: number | null
  parentShareId: number | null
  allowReshare: boolean
  maxEpisodes: number
  usedEpisodes: number
  active: boolean
}
type Code = {
  id: number
  label: string | null
  usedCount: number
  maxUses: number
  dailyMaxUses: number | null
  dailyUsedCount: number
  dailyUsedOn: string | null
  teamAccess: boolean
  expiresAt: string | null
}
const inviteState = (code: Code) =>
  code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now()
    ? '已关闭'
    : code.usedCount >= code.maxUses
      ? '已用完'
      : `剩余 ${code.maxUses - code.usedCount} 次`
const accessText = (access?: { source: string; error?: string }) =>
  !access
    ? '正在检查…'
    : access.error ||
      (access.source === 'own'
        ? '使用自己的 API'
        : access.source === 'member'
          ? '使用成员分享额度'
          : access.source === 'default'
            ? '使用平台默认共享 API（受平台总额度限制）'
            : '使用管理员授权额度')

// 设置页的两个小件：分节标题、说明行
function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="ys-title text-lg">{title}</h2>
      {description && <p className="text-sm text-ink-soft">{description}</p>}
    </div>
  )
}
function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-ink-soft">{children}</p>
}

export default function SettingsPage() {
  const locale = (useParams()?.locale || 'zh') as LocaleTypes
  const [loggingOut, setLoggingOut] = useState(false)
  const [renewingCode, setRenewingCode] = useState(false)
  const [platformOwner, setPlatformOwner] = useState(false)
  const [defaultShared, setDefaultShared] = useState(false)
  const [savingDefaultShared, setSavingDefaultShared] = useState(false)
  const [ready, setReady] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [configured, setConfigured] = useState<Record<string, boolean>>({})
  const [apiEnabled, setApiEnabled] = useState<Record<'llm' | 'tts', boolean>>({
    llm: true,
    tts: true,
  })
  const [savingToggle, setSavingToggle] = useState<'llm' | 'tts' | null>(null)
  const [access, setAccess] = useState<any>(null)
  const [ttsAccess, setTtsAccess] = useState<Record<
    string,
    { source: string; error?: string }
  > | null>(null)
  const [message, setMessage] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [loginCode, setLoginCode] = useState('')
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
    } finally {
      setTeamLoading(false)
    }
  }

  async function loadShares() {
    try {
      const response = await fetch('/api/user/api-shares')
      if (!response.ok) throw new Error('API 分享列表加载失败')
      const data = await response.json()
      setShares(data.shares || [])
      setShareUsers(data.users || [])
      setShareLimits(
        Object.fromEntries(
          (data.shares || []).map((share: ApiShare) => [share.id, share.maxEpisodes])
        )
      )
      setShareError('')
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'API 分享列表加载失败')
    }
  }

  async function load(refreshTeam = true) {
    const me = await fetch('/api/auth/me').then((response) => response.json())
    setPlatformOwner(Boolean(me.isSuperAdmin))
    setCurrentUserId(me.userId || 0)
    setDisplayName(me.displayName || '')
    const response = await fetch(
      me.isSuperAdmin ? '/api/admin/settings' : '/api/user/settings?allTts=1'
    )
    if (!response.ok) {
      setMessage('请先登录')
      setReady(true)
      return
    }
    const data = await response.json()
    const next: Record<string, string> = {}
    const flags: Record<string, boolean> = {}
    for (const [key] of fields) {
      if (secrets.has(key)) flags[key] = Boolean(data.settings[key])
      else next[key] = data.settings[key] || ''
    }
    setValues(next)
    setConfigured(flags)
    setDefaultShared(data.settings.API_DEFAULT_SHARED_ENABLED === '1')
    setApiEnabled({
      llm: data.settings.API_LLM_ENABLED !== '0',
      tts: data.settings.API_TTS_ENABLED !== '0',
    })
    setAccess(data.access || null)
    setTtsAccess(data.ttsAccess || null)
    setReady(true)
    if (me.isSuperAdmin && refreshTeam) void loadTeam()
    if (refreshTeam) void loadShares()
  }
  // Initial data is loaded once; later updates call load or loadTeam explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load().catch(() => {
      setMessage('配置加载失败')
      setReady(true)
    })
  }, [])

  async function save() {
    setMessage('保存中…')
    const response = await fetch(platformOwner ? '/api/admin/settings' : '/api/user/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    })
    const data = await response.json()
    setMessage(response.ok ? '已保存' : data.error || '保存失败')
    if (response.ok) await load(false)
  }
  async function clearSecret(key: string) {
    if (platformOwner) return
    const response = await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ [key]: null }),
    })
    setMessage(response.ok ? '已移除私有密钥' : (await response.json()).error)
    if (response.ok) await load(false)
  }
  async function toggleApi(capability: 'llm' | 'tts') {
    const next = !apiEnabled[capability]
    const key = capability === 'llm' ? 'API_LLM_ENABLED' : 'API_TTS_ENABLED'
    setSavingToggle(capability)
    try {
      const response = await fetch(platformOwner ? '/api/admin/settings' : '/api/user/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [key]: next ? '1' : '0' }),
      })
      const data = await response.json()
      setMessage(
        response.ok
          ? `${capability === 'llm' ? '大模型' : '语音'} API 已${next ? '启用' : '停用'}`
          : data.error || '切换失败'
      )
      if (response.ok) await load(false)
    } finally {
      setSavingToggle(null)
    }
  }
  async function revokeOtherAdminSessions() {
    if (!window.confirm('让除当前浏览器之外的所有管理员登录失效？当前管理员会话会保留。')) return
    const response = await fetch('/api/admin/sessions', { method: 'DELETE' })
    const data = await response.json()
    setMessage(
      response.ok
        ? `已撤销 ${data.revoked} 个其他管理员会话，清理 ${data.purged ?? 0} 条过期记录；当前登录保留`
        : data.error || '撤销失败'
    )
  }
  async function createShare() {
    const response = await fetch('/api/user/api-shares', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        recipientUserId: Number(shareRecipient),
        capability: shareCapability,
        maxEpisodes: shareEpisodes,
        parentShareId: shareSource ? Number(shareSource) : null,
      }),
    })
    const data = await response.json()
    setMessage(response.ok ? '已分享调用额度；对方看不到你的密钥' : data.error || '分享失败')
    if (response.ok) await loadShares()
  }
  async function updateShare(
    share: ApiShare,
    active = share.active,
    allowReshare = share.allowReshare
  ) {
    const response = await fetch('/api/user/api-shares', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: share.id,
        active,
        maxEpisodes: shareLimits[share.id],
        ...(platformOwner || share.ownerUserId === currentUserId ? { allowReshare } : {}),
      }),
    })
    const data = await response.json()
    setMessage(response.ok ? '分享设置已更新' : data.error || '更新失败')
    if (response.ok) await loadShares()
  }
  async function renewLoginCode() {
    setRenewingCode(true)
    try {
      const response = await fetch('/api/user/login-code', { method: 'POST' })
      const data = await response.json()
      if (response.ok) setLoginCode(data.code)
      setMessage(response.ok ? '请保存新的个人登录码；旧码已失效。' : data.error || '生成失败')
    } catch {
      setMessage('登录码生成失败，请检查网络后重试')
    } finally {
      setRenewingCode(false)
    }
  }
  async function logout() {
    if (
      !window.confirm(
        '退出前请保存个人登录码，以便回到同一账号。退出不会删除节目、私有 API 或分享设置。现在退出？'
      )
    )
      return
    setLoggingOut(true)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('退出失败，请重试')
      window.location.assign(getLocalePath(locale, '/enter-code'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '退出失败')
      setLoggingOut(false)
    }
  }
  async function saveProfile() {
    if (savingName) return
    setSavingName(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '保存失败')
      setDisplayName(body.displayName)
      window.dispatchEvent(new CustomEvent('tocast-profile-updated', { detail: body.displayName }))
      setMessage('昵称已保存')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSavingName(false)
    }
  }
  async function grant() {
    const [kind, idString] = target.split(':')
    const id = Number(idString)
    const response = await fetch('/api/admin/grants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        capability,
        maxEpisodes: episodes,
        userId: kind === 'user' ? id : null,
        inviteCodeId: kind === 'code' ? id : null,
      }),
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
  const shell = 'mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8'

  if (!ready)
    return (
      <main className={shell}>
        <h1 className="ys-title text-2xl sm:text-[28px]">模型与权限设置</h1>
        <p role="status" className="flex items-center gap-2 text-sm text-ink-soft">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在加载配置…
        </p>
        <div className="ys-sheet h-56 animate-pulse" />
      </main>
    )

  return (
    <main className={shell}>
      <header className="flex flex-col gap-1.5">
        <h1 className="ys-title text-2xl sm:text-[28px]">模型与权限设置</h1>
        <p className="max-w-3xl text-sm text-ink-soft">
          {platformOwner
            ? defaultShared
              ? '已开启默认共享：已登录内测成员可使用平台聊天模型和 MiniMax 配音，受全平台生成额度限制。'
              : '默认共享已关闭；全局密钥仅供超级管理员及单独获授权的成员使用。'
            : '你的密钥只保存在服务端，默认仅自己的任务使用；主动分享后，指定成员才能在额度内调用。私有配置优先于共享授权。'}
        </p>
      </header>

      {message && (
        <p
          role="status"
          className="ys-note sticky top-[4.5rem] z-30 flex items-center gap-2 border border-rule bg-sheet text-ink shadow-bar"
        >
          <CircleAlert className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          {message}
        </p>
      )}

      {!platformOwner && access && (
        <section className="ys-sheet flex flex-col gap-3 p-5">
          <SectionHeading title="当前可用权限" />
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3 rounded-control bg-paper px-3 py-2">
              <dt className="text-ink-soft">大模型</dt>
              <dd className="text-right text-ink">{accessText(access.llm)}</dd>
            </div>
            {Object.values(Platform).map((platform) => (
              <div
                key={platform}
                className="flex justify-between gap-3 rounded-control bg-paper px-3 py-2"
              >
                <dt className="text-ink-soft">{CAPABILITY_LABELS[TTS_CAPABILITIES[platform]]}</dt>
                <dd className="text-right text-ink">{accessText(ttsAccess?.[platform])}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-ink-soft">
            按主题生成需要额外配置搜索模型；管理员授权按完整节目计数。
          </p>
        </section>
      )}

      <section className="ys-sheet flex flex-wrap items-end gap-3 p-5">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
          <span className="ys-label">我的姓名 / 昵称</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={40}
            placeholder="填写你希望展示给其他成员的名称"
            className="ys-field"
          />
        </label>
        <button
          onClick={saveProfile}
          disabled={savingName || !displayName.trim()}
          className="ys-btn ys-btn-secondary"
        >
          {savingName ? '保存中…' : '保存昵称'}
        </button>
      </section>

      {platformOwner && <TranscriptFallbackPanel />}
      <section className="ys-sheet flex flex-col gap-5 p-5 sm:p-6">
        <SectionHeading
          title={platformOwner ? '全局 API' : '我的私有 API'}
          description={
            platformOwner
              ? '停用后，你和获得共享授权的成员都不会使用这类全局 API；各成员自己的密钥不受影响。'
              : '可分别停用自己的大模型或语音密钥，密钥会保留；若有管理员共享授权，会自动改用共享额度。'
          }
        />
        {platformOwner && (
          <div className="rounded-control border border-rule p-4">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm">所有内测成员默认使用平台 API</strong>
              <button
                type="button"
                disabled={savingDefaultShared}
                className="ys-btn-sm ys-btn-secondary"
                onClick={async () => {
                  setSavingDefaultShared(true)
                  try {
                    const response = await fetch('/api/admin/settings', {
                      method: 'PUT',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({
                        API_DEFAULT_SHARED_ENABLED: defaultShared ? '0' : '1',
                      }),
                    })
                    if (!response.ok) throw new Error('默认共享设置保存失败')
                    await load(false)
                    setMessage('默认共享设置已保存')
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : '保存失败')
                  } finally {
                    setSavingDefaultShared(false)
                  }
                }}
              >
                {savingDefaultShared ? '保存中…' : defaultShared ? '停用默认共享' : '启用默认共享'}
              </button>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              当前{defaultShared ? '已开启' : '已关闭'}
              。开启后，现有及新加入的已登录成员可默认使用平台聊天模型和 MiniMax 配音。 自己的 API
              完整并启用时优先使用自己的 Key；平台 API
              必须启用，所有生成任务仍受「额度管理」的个人及全平台上限约束。
              关闭默认共享不会撤销单独发放的授权；相关调用费用由平台 Key 持有人承担。
            </p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {(['llm', 'tts'] as const).map((kind) => (
            <div
              key={kind}
              className="flex items-center justify-between gap-3 rounded-control border border-rule px-4 py-3"
            >
              <span className="flex items-center gap-2 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${apiEnabled[kind] ? 'bg-voice' : 'bg-rule-strong'}`}
                  aria-hidden="true"
                />
                <strong className="text-ink">{kind === 'llm' ? '大模型' : 'MiniMax 语音'}</strong>
                <span className="text-ink-soft">{apiEnabled[kind] ? '已启用' : '已停用'}</span>
              </span>
              <button
                type="button"
                onClick={() => void toggleApi(kind)}
                disabled={savingToggle !== null}
                aria-label={`${apiEnabled[kind] ? '停用' : '启用'}${kind === 'llm' ? '大模型' : '语音'} API`}
                className="ys-btn-sm ys-btn-secondary"
              >
                {savingToggle === kind ? '保存中…' : apiEnabled[kind] ? '停用' : '启用'}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-soft">
          密钥留空表示保留已有值。URL 只接受已接入服务的 HTTPS 地址。
        </p>
        <ModelConfigGuide
          onApply={(template) => {
            setValues((current) =>
              Object.fromEntries(
                [...new Set([...Object.keys(current), ...Object.keys(template)])].map((key) => [
                  key,
                  current[key] || template[key] || '',
                ])
              )
            )
            setMessage('已填入空白的聊天字段；请填写自己的 API Key 后保存配置。')
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1.5">
              <span className="ys-label flex items-center gap-1.5">
                {label}
                {configured[key] && (
                  <span className="ys-pill bg-voice-tint py-0 text-[11px] text-voice-deep">
                    已配置
                  </span>
                )}
              </span>
              <div className="flex gap-1.5">
                <input
                  type={secrets.has(key) ? 'password' : 'text'}
                  value={values[key] || ''}
                  onChange={(event) => setValues({ ...values, [key]: event.target.value })}
                  placeholder={secrets.has(key) && configured[key] ? '留空则保留已有密钥' : ''}
                  className="ys-field min-w-0"
                  autoComplete="off"
                />
                {!platformOwner && secrets.has(key) && configured[key] && (
                  <button
                    type="button"
                    onClick={() => clearSecret(key)}
                    className="ys-btn ys-btn-danger px-3 text-xs"
                  >
                    移除
                  </button>
                )}
              </div>
              <span className="text-xs leading-5 text-ink-soft">{MODEL_FIELD_HELP[key]}</span>
            </label>
          ))}
        </div>
        <div>
          <button onClick={save} className="ys-btn ys-btn-primary">
            保存配置
          </button>
        </div>
      </section>

      <section className="ys-sheet flex flex-col gap-4 p-5 sm:p-6">
        <SectionHeading
          title="成员 API 分享"
          description="分享的是服务端调用额度，不显示或发送密钥明文。原持有人可开启转分享；上游暂停、额度用完或密钥停用时，下游也会停止。"
        />
        {shareError && (
          <p role="alert" className="ys-note bg-alert-tint text-alert-deep">
            {shareError}{' '}
            <button onClick={loadShares} className="font-semibold underline">
              重试
            </button>
          </p>
        )}
        {!platformOwner && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="ys-label">分享来源</span>
              <select
                aria-label="分享来源"
                value={shareSource}
                onChange={(event) => setShareSource(event.target.value)}
                className="ys-field-sm min-h-10 w-auto pr-8"
              >
                <option value="">我的私有 API</option>
                {shares
                  .filter(
                    (share) =>
                      share.recipientUserId === currentUserId &&
                      share.capability === shareCapability &&
                      share.allowReshare &&
                      share.active &&
                      share.usedEpisodes < share.maxEpisodes
                  )
                  .map((share) => (
                    <option key={share.id} value={share.id}>
                      获准转分享 #{share.id}（剩余 {share.maxEpisodes - share.usedEpisodes} 期）
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="ys-label">分享给</span>
              <select
                aria-label="分享给成员"
                value={shareRecipient}
                onChange={(event) => setShareRecipient(event.target.value)}
                className="ys-field-sm min-h-10 w-auto pr-8"
              >
                <option value="">选择接收成员</option>
                {shareUsers
                  .filter((item) => item.id !== currentUserId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName || `用户 #${item.id}`}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="ys-label">能力</span>
              <select
                aria-label="分享能力"
                value={shareCapability}
                onChange={(event) => {
                  setShareCapability(event.target.value as ShareCapability)
                  setShareSource('')
                }}
                className="ys-field-sm min-h-10 w-auto pr-8"
              >
                {Object.entries(CAPABILITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="ys-label">总期数</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={shareEpisodes}
                onChange={(event) => setShareEpisodes(Number(event.target.value))}
                className="ys-field-sm min-h-10 w-20"
              />
            </label>
            <button
              onClick={createShare}
              disabled={!shareRecipient}
              className="ys-btn ys-btn-primary min-h-10"
            >
              分享额度
            </button>
          </div>
        )}
        <div className="divide-y divide-rule text-sm">
          {shares.length === 0 && !shareError && <EmptyLine>暂无成员 API 分享</EmptyLine>}
          {shares.map((share) => (
            <div key={share.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="text-ink">
                <strong>
                  {shareUsers.find((item) => item.id === share.delegatedByUserId)?.displayName ||
                    `用户 #${share.delegatedByUserId || share.ownerUserId}`}
                </strong>
                <span className="text-ink-soft"> 分享给 </span>
                <strong>
                  {shareUsers.find((item) => item.id === share.recipientUserId)?.displayName ||
                    `用户 #${share.recipientUserId}`}
                </strong>
                <span className="ml-2 text-ink-soft">
                  {CAPABILITY_LABELS[share.capability] || share.capability}，已用{' '}
                  {share.usedEpisodes}/{share.maxEpisodes} 期
                </span>
                <span
                  className={`ys-pill ml-2 ${share.active ? 'bg-voice-tint text-voice-deep' : 'bg-paper text-ink-soft'}`}
                >
                  {share.active ? '启用' : '暂停'}
                </span>
                {share.parentShareId && (
                  <span className="ys-tag ml-1">来自分享 #{share.parentShareId}</span>
                )}
                {share.allowReshare && <span className="ys-tag ml-1">可转分享</span>}
              </span>
              {(platformOwner ||
                share.ownerUserId === currentUserId ||
                share.delegatedByUserId === currentUserId) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    aria-label={`分享 #${share.id} 总期数`}
                    type="number"
                    min={share.usedEpisodes || 1}
                    max="1000"
                    value={shareLimits[share.id] ?? share.maxEpisodes}
                    onChange={(event) =>
                      setShareLimits({ ...shareLimits, [share.id]: Number(event.target.value) })
                    }
                    className="ys-field-sm w-20"
                  />
                  <button onClick={() => updateShare(share)} className="ys-btn-sm ys-btn-secondary">
                    保存额度
                  </button>
                  <button
                    onClick={() => updateShare(share, !share.active)}
                    className="ys-btn-sm ys-btn-secondary"
                  >
                    {share.active ? '暂停' : '启用'}
                  </button>
                  {(platformOwner || share.ownerUserId === currentUserId) && (
                    <button
                      onClick={() => updateShare(share, share.active, !share.allowReshare)}
                      className="ys-btn-sm ys-btn-secondary"
                    >
                      {share.allowReshare ? '关闭转分享' : '允许转分享'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="ys-sheet flex flex-col gap-4 p-5 sm:p-6">
        <SectionHeading
          title="账号与登录"
          description="个人登录码用于回到同一个账户；邀请码用于首次加入。重新生成个人码会立即使旧码失效，但不会退出当前浏览器。"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={renewLoginCode}
            disabled={!currentUserId || renewingCode || loggingOut}
            className="ys-btn ys-btn-secondary"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {renewingCode ? '正在生成…' : '生成新登录码'}
          </button>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut || renewingCode || !currentUserId}
            className="ys-btn ys-btn-secondary"
          >
            {loggingOut ? '正在退出…' : '退出当前账号'}
          </button>
        </div>
        {loginCode && <output className="ys-code tracking-wider">{loginCode}</output>}
        <p className="text-sm text-ink-soft">
          登录码只显示一次，请保存在密码管理器里。浏览器会话有效期 30
          天；同一账号在其他设备登录会替换原设备会话。
        </p>
        <p className="text-sm text-ink-soft">
          {platformOwner
            ? '超级管理员忘记个人码但仍保持登录时，可在这里生成新码；全部退出且忘记码时，通过部署恢复入口登录，再生成个人码。恢复入口会恢复同一个超级管理员账号。'
            : '忘记个人码但仍保持登录时，可直接生成新码；已经退出时请联系管理员重置。不要再次兑换邀请码，否则会创建另一个账户。'}
        </p>
        {platformOwner && (
          <p className="text-xs text-ink-soft">
            「撤销其他管理员登录」也会使那些管理员账户的个人登录码失效；部署恢复码需由维护者在
            Vercel 单独轮换。
          </p>
        )}
      </section>
      <a href={getLocalePath(locale, '/workspace')} className="ys-btn ys-btn-secondary">
        管理用户、邀请码与额度 → 管理工作台
      </a>
      <FeishuLogin bind />
      <UsageGuide resources />

      {platformOwner && (
        <>
          <section className="ys-sheet flex flex-wrap items-center justify-between gap-3 p-5">
            <SectionHeading
              title="管理员登录"
              description="保留当前浏览器的管理员会话，让其他管理员令牌失效。"
            />
            <button
              type="button"
              onClick={revokeOtherAdminSessions}
              className="ys-btn ys-btn-danger"
            >
              撤销其他管理员登录
            </button>
          </section>
          {teamError && (
            <p role="alert" className="ys-note bg-alert-tint text-alert-deep">
              {teamError}{' '}
              <button
                type="button"
                className="ml-2 font-semibold underline"
                onClick={() => void loadTeam()}
              >
                重试
              </button>
            </p>
          )}
          <section className="ys-sheet flex flex-col gap-4 p-5 sm:p-6">
            <SectionHeading
              title="共享 API 授权"
              description="可指定邀请码或已加入的用户；每个语音平台单独授权，额度按节目计算。"
            />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_6rem_auto]">
              <select
                aria-label="授权对象"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="ys-field min-w-0 pr-8"
              >
                <option value="">选择用户或邀请码</option>
                {users.map((user) => (
                  <option key={user.id} value={`user:${user.id}`}>
                    用户 #{user.id} {user.displayName || ''}
                  </option>
                ))}
                {codes.map((code) => (
                  <option key={code.id} value={`code:${code.id}`}>
                    邀请码 #{code.id} {code.label || ''} · {'内测'} · {inviteState(code)}
                  </option>
                ))}
              </select>
              <select
                aria-label="能力"
                value={capability}
                onChange={(event) => setCapability(event.target.value as ShareCapability)}
                className="ys-field pr-8"
              >
                {Object.entries(CAPABILITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                aria-label="节目额度"
                type="number"
                min="1"
                max="1000"
                value={episodes}
                onChange={(event) => setEpisodes(Number(event.target.value))}
                className="ys-field"
              />
              <button
                onClick={grant}
                disabled={!target || teamLoading}
                className="ys-btn ys-btn-primary"
              >
                授权
              </button>
            </div>
            <div className="divide-y divide-rule text-sm">
              {teamLoading && grants.length === 0 && <EmptyLine>正在加载授权…</EmptyLine>}
              {!teamLoading && !teamError && grants.length === 0 && (
                <EmptyLine>尚未分配共享 API 额度</EmptyLine>
              )}
              {grants.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span className="text-ink">
                    {item.userId ? `用户 #${item.userId}` : `邀请码 #${item.inviteCodeId}`}
                    <span className="text-ink-soft">
                      ，{CAPABILITY_LABELS[item.capability as ShareCapability] || item.capability}，
                      {item.usedEpisodes}/{item.maxEpisodes} 期
                    </span>
                  </span>
                  <button onClick={() => revoke(item.id)} className="ys-btn-sm ys-btn-danger">
                    撤销
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
