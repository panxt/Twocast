'use client'
import { SHARE_CAPABILITIES, CAPABILITY_LABELS } from '@/lib/api-capabilities'
import PrivateApiPanel from './PrivateApiPanel'
import AccountManagement from './AccountManagement'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

type Team = { id: number; name: string; active: boolean }
type Member = { teamId: number; userId: number; role: string; displayName: string | null }
type Policy = {
  scope: string
  scopeId: number
  dailyLimit: number | null
  totalLimit: number | null
  concurrentLimit: number | null
  storageBytes: number | null
}
type Invite = {
  accountRole: string
  id: number
  label: string
  maxUses: number
  usedCount: number
  expiresAt: string | null
}
type Dashboard = {
  stats: {
    total: number
    success: number
    failed: number
    active: number
    duration: number
    bytes: number
  }
  personalUsage: { total: number; today: number }
  personalStorage: { bytes: number }
  personalPolicy: Policy | null
  byDay: { day: string; count: number }[]
  byProvider: { provider: string; count: number }[]
  platformStorage: { bucket: string; objects: number; bytes: string }[] | null
  notes: string[]
}
async function api(path: string, body?: unknown, method = 'POST') {
  const response = await fetch(
    path,
    body === undefined
      ? { cache: 'no-store' }
      : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  )
  if (response.redirected || response.status === 401)
    throw new Error('登录已失效，请重新登录后重试。')
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('服务暂时无法响应，请稍后重试。')
  }
  if (!response.ok) throw new Error(data.error || '操作失败')
  return data
}
const blankPolicy: Policy = {
  scope: 'default',
  scopeId: 0,
  dailyLimit: 3,
  totalLimit: null,
  concurrentLimit: 1,
  storageBytes: null,
}
export default function WorkspaceConsole() {
  const [tab, setTab] = useState('overview')
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [users, setUsers] = useState<{ id: number; displayName: string | null }[]>([])
  const [superAdmin, setSuperAdmin] = useState(false)
  const [inviteRole, setInviteRole] = useState('member')
  const [admin, setAdmin] = useState(false)
  const [teamAdmins, setTeamAdmins] = useState<number[]>([])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [scope, setScope] = useState('mine')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [policies, setPolicies] = useState<Policy[]>([])
  const [policy, setPolicy] = useState<Policy>(blankPolicy)
  const [invites, setInvites] = useState<Invite[]>([])
  const [assignments, setAssignments] = useState<{ inviteCodeId: number; teamId: number }[]>([])
  const [inviteTeams, setInviteTeams] = useState<number[]>([])
  const [editingInvite, setEditingInvite] = useState<number | null>(null)
  const [inviteActive, setInviteActive] = useState(true)
  const [inviteLabel, setInviteLabel] = useState('')
  const [inviteLimit, setInviteLimit] = useState(10)
  const [newCode, setNewCode] = useState('')
  const load = useCallback(async () => {
    try {
      setError('')
      const [teamData, dash] = await Promise.all([
        api('/api/protected/teams'),
        api(
          `/api/protected/dashboard?scope=${scope.startsWith('team:') ? 'team' : scope}${scope.startsWith('team:') ? `&team=${scope.slice(5)}` : ''}`
        ),
      ])
      setTeams(teamData.teams)
      setMembers(teamData.members)
      setUsers(teamData.users)
      setAdmin(teamData.isAdmin)
      setSuperAdmin(teamData.isSuperAdmin)
      setTeamAdmins(teamData.teamAdminIds)
      setDashboard(dash)
      if (teamData.isAdmin) {
        const [q, codes] = await Promise.all([
          api('/api/admin/quotas'),
          api('/api/admin/team-invites'),
        ])
        setPolicies(q.policies)
        setInvites(codes.codes)
        setAssignments(codes.assignments)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
  }, [scope])
  useEffect(() => {
    void load()
  }, [load])
  async function act(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      toast.success('已保存')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="ys-title text-3xl">团队工作台</h1>
        <button className="ys-btn-sm ys-btn-secondary" onClick={() => void load()}>
          刷新数据
        </button>
      </div>
      <nav aria-label="工作台栏目" className="flex flex-wrap gap-2">
        {[
          ['overview', '使用概览'],
          ['teams', '团队与成员'],
          ...(admin
            ? [
                ['invites', '邀请码'],
                ['accounts', '账号与角色'],
                ['quotas', '额度管理'],
              ]
            : []),
          ['shares', 'API 分享额度'],
          ['imports', '导入作品'],
          ['recycle', '回收站'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`ys-btn-sm ${tab === id ? 'ys-btn-primary' : 'ys-btn-secondary'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="ys-note text-alert-deep">
          {error}
          <button className="ml-3 underline" onClick={() => void load()}>
            重试
          </button>
        </p>
      )}
      {!dashboard && !error && <p role="status">正在加载工作台…</p>}
      {tab === 'overview' && dashboard && (
        <>
          <label className="flex max-w-sm items-center gap-3">
            查看范围
            <select className="ys-field" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="mine">我的作品</option>
              <option value="public">公共空间</option>
              <option value="team">可见团队作品</option>
              {admin && <option value="all">全平台</option>}
              {teams
                .filter((t) => t.active)
                .map((t) => (
                  <option key={t.id} value={`team:${t.id}`}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          {dashboard.personalPolicy?.storageBytes != null && (
            <div className="ys-note text-sm">
              <p>
                个人存储 {(dashboard.personalStorage.bytes / 1e6).toFixed(1)} /{' '}
                {(dashboard.personalPolicy.storageBytes / 1e6).toFixed(1)} MB
              </p>
              <progress
                className="w-full"
                max={Math.max(1, dashboard.personalPolicy.storageBytes)}
                value={dashboard.personalStorage.bytes}
              />
              {dashboard.personalStorage.bytes >= dashboard.personalPolicy.storageBytes * 0.8 && (
                <p className="text-alert-deep">存储接近或达到上限，请清理文件或联系管理员调整。</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['作品', dashboard.stats.total],
              ['已完成', dashboard.stats.success],
              ['失败', dashboard.stats.failed],
              ['进行中', dashboard.stats.active],
              ['音频时长', `${Math.round(dashboard.stats.duration / 60)} 分钟`],
              ['音频占用', `${(dashboard.stats.bytes / 1e6).toFixed(1)} MB`],
              [
                '我今日生成',
                `${dashboard.personalUsage.today} / ${dashboard.personalPolicy?.dailyLimit ?? '不限'}`,
              ],
              [
                '我累计生成',
                `${dashboard.personalUsage.total} / ${dashboard.personalPolicy?.totalLimit ?? '不限'}`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="ys-sheet p-4">
                <p className="text-sm text-ink-soft">{label}</p>
                <p className="mt-2 text-2xl tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="ys-sheet space-y-2 p-5">
              <h2 className="ys-title text-xl">最近 14 天</h2>
              {dashboard.byDay.map((d) => (
                <div key={d.day} className="flex items-center gap-3 text-sm">
                  <span>{d.day}</span>
                  <meter
                    className="flex-1"
                    min={0}
                    max={Math.max(1, ...dashboard.byDay.map((x) => x.count))}
                    value={d.count}
                  />
                  <span>{d.count} 期</span>
                </div>
              ))}
              {!dashboard.byDay.length && <p>暂无记录</p>}
            </section>
            <section className="ys-sheet space-y-2 p-5">
              <h2 className="ys-title text-xl">语音提供商</h2>
              {dashboard.byProvider.map((p) => (
                <p key={p.provider}>
                  {p.provider} · {p.count} 期
                </p>
              ))}
            </section>
          </div>
          {dashboard.platformStorage && (
            <section className="ys-sheet space-y-2 p-5">
              <h2 className="ys-title text-xl">平台存储实际占用</h2>
              {dashboard.platformStorage.map((s) => (
                <p key={s.bucket}>
                  {s.bucket} · {s.objects} 个文件 · {(Number(s.bytes) / 1e6).toFixed(1)} MB
                </p>
              ))}
              <p className="text-sm text-ink-soft">
                包含临时音频。套餐容量及供应商余额尚未接入，不能据此判断账单。
              </p>
              <button
                disabled={busy}
                className="ys-btn-sm ys-btn-secondary"
                onClick={() =>
                  void act(async () => {
                    const d = await api('/api/admin/cleanup', {})
                    toast.success(`已清理 ${d.removed} 个过期临时文件`)
                  })
                }
              >
                清理过期临时文件
              </button>
            </section>
          )}
          <div className="ys-note space-y-1 text-sm">
            {dashboard.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        </>
      )}
      {tab === 'teams' && (
        <>
          {admin && (
            <form
              className="ys-sheet flex gap-3 p-4"
              onSubmit={(e) => {
                e.preventDefault()
                void act(async () => {
                  await api('/api/protected/teams', { name: teamName })
                  setTeamName('')
                })
              }}
            >
              <input
                className="ys-field"
                aria-label="新团队名称"
                placeholder="新团队名称"
                maxLength={80}
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
              <button disabled={busy} className="ys-btn ys-btn-primary">
                创建团队
              </button>
            </form>
          )}
          {teams.map((t) => (
            <section key={t.id} className="ys-sheet space-y-3 p-5">
              <div className="flex justify-between">
                <h2 className="ys-title text-xl">
                  {t.name}
                  {!t.active && '（已停用）'}
                </h2>
                {admin && (
                  <button
                    disabled={busy}
                    className="ys-btn-sm ys-btn-secondary"
                    onClick={() =>
                      void act(() =>
                        api(
                          '/api/protected/teams',
                          { teamId: t.id, name: t.name, active: !t.active },
                          'PATCH'
                        )
                      )
                    }
                  >
                    {t.active ? '停用' : '启用'}
                  </button>
                )}
              </div>
              {members
                .filter((m) => m.teamId === t.id)
                .map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-2">
                    <span>{m.displayName || `用户 #${m.userId}`}</span>
                    {admin || teamAdmins.includes(t.id) ? (
                      <select
                        aria-label={`${m.displayName || m.userId} 的团队角色`}
                        className="ys-field max-w-40"
                        value={m.role}
                        disabled={busy}
                        onChange={(e) =>
                          void act(() =>
                            api(
                              '/api/protected/teams',
                              { teamId: t.id, userId: m.userId, role: e.target.value },
                              'PATCH'
                            )
                          )
                        }
                      >
                        <option value="member">成员</option>
                        <option value="admin">团队管理员</option>
                        <option value="remove">移出团队</option>
                      </select>
                    ) : (
                      <span>{m.role === 'admin' ? '团队管理员' : '成员'}</span>
                    )}
                  </div>
                ))}
              {admin && (
                <select
                  className="ys-field"
                  aria-label={`添加成员到${t.name}`}
                  value=""
                  disabled={busy}
                  onChange={(e) =>
                    e.target.value &&
                    void act(() =>
                      api(
                        '/api/protected/teams',
                        { teamId: t.id, userId: Number(e.target.value), role: 'member' },
                        'PATCH'
                      )
                    )
                  }
                >
                  <option value="">添加已有用户</option>
                  {users
                    .filter((u) => !members.some((m) => m.teamId === t.id && m.userId === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName || `用户 #${u.id}`}
                      </option>
                    ))}
                </select>
              )}
            </section>
          ))}
          {!teams.length && <p>尚未加入团队。</p>}
        </>
      )}
      {tab === 'accounts' && admin && <AccountManagement />}
      {tab === 'invites' && admin && (
        <>
          <form
            className="ys-sheet space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault()
              void act(async () => {
                const d = await api(
                  '/api/admin/team-invites',
                  {
                    id: editingInvite ?? undefined,
                    active: inviteActive,
                    label: inviteLabel,
                    accountRole: inviteRole,
                    maxUses: inviteLimit,
                    teamIds: inviteTeams,
                  },
                  editingInvite ? 'PATCH' : 'POST'
                )
                if (d.code) setNewCode(d.code)
                setEditingInvite(null)
              })
            }}
          >
            <h2 className="ys-title text-xl">
              {editingInvite ? `编辑邀请码 #${editingInvite}` : '创建团队邀请码'}
            </h2>
            {superAdmin && (
              <label className="block">
                加入后的角色
                <select
                  className="ys-field"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="member">普通成员</option>
                  <option value="admin">管理员</option>
                </select>
              </label>
            )}
            <label className="block">
              备注
              <input
                className="ys-field"
                maxLength={120}
                value={inviteLabel}
                onChange={(e) => setInviteLabel(e.target.value)}
              />
            </label>
            <label className="block">
              可兑换人数
              <input
                className="ys-field"
                type="number"
                min={1}
                max={10000}
                value={inviteLimit}
                onChange={(e) => setInviteLimit(Number(e.target.value))}
              />
            </label>
            <p className="text-sm text-ink-soft">
              生成额度与邀请码兑换分开管理；每日生成额度用完不会阻止加入。
            </p>
            {teams
              .filter((t) => t.active)
              .map((t) => (
                <label key={t.id} className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={inviteTeams.includes(t.id)}
                    onChange={(e) =>
                      setInviteTeams((v) =>
                        e.target.checked ? [...v, t.id] : v.filter((id) => id !== t.id)
                      )
                    }
                  />
                  {t.name}
                </label>
              ))}
            <button disabled={busy} className="ys-btn ys-btn-primary">
              {editingInvite ? '保存修改' : '生成邀请码'}
            </button>
            {newCode && (
              <p className="break-all rounded bg-paper p-3">请保存，仅展示一次：{newCode}</p>
            )}
          </form>
          {invites.map((c) => (
            <div className="ys-sheet flex flex-wrap items-center gap-3 p-4" key={c.id}>
              <button
                className="ys-btn-sm ys-btn-secondary"
                disabled={busy}
                onClick={() => {
                  setEditingInvite(c.id)
                  setInviteRole(c.accountRole || 'member')
                  setInviteLabel(c.label || '')
                  setInviteLimit(c.maxUses)
                  setInviteActive(!c.expiresAt)
                  setInviteTeams(
                    assignments.filter((a) => a.inviteCodeId === c.id).map((a) => a.teamId)
                  )
                  setNewCode('')
                }}
              >
                编辑
              </button>
              <span className="flex-1">
                #{c.id} {c.label} · {c.accountRole === 'admin' ? '管理员内测码' : '成员邀请码'} ·
                已兑换 {c.usedCount}/{c.maxUses} ·{' '}
                {assignments
                  .filter((a) => a.inviteCodeId === c.id)
                  .map((a) => teams.find((t) => t.id === a.teamId)?.name)
                  .join('、') || '无团队'}
                {c.expiresAt && ' · 已关闭'}
              </span>
              <button
                disabled={busy}
                className="ys-btn-sm ys-btn-secondary"
                onClick={() =>
                  void act(() =>
                    api(
                      '/api/admin/team-invites',
                      {
                        id: c.id,
                        label: c.label || '',
                        accountRole: c.accountRole,
                        maxUses: c.maxUses,
                        teamIds: assignments
                          .filter((a) => a.inviteCodeId === c.id)
                          .map((a) => a.teamId),
                        active: Boolean(c.expiresAt),
                      },
                      'PATCH'
                    )
                  )
                }
              >
                {c.expiresAt ? '启用' : '关闭'}
              </button>
            </div>
          ))}
        </>
      )}
      {tab === 'quotas' && admin && (
        <form
          className="ys-sheet space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            void act(() => api('/api/admin/quotas', policy, 'PUT'))
          }}
        >
          <h2 className="ys-title text-xl">额度策略</h2>
          <p className="text-sm text-ink-soft">
            留空表示不限，0
            表示暂停。个人设置覆盖默认个人额度，同时受平台和所选团队额度约束。失败任务释放次数；删除已完成作品不退还次数。
          </p>
          <select
            className="ys-field"
            aria-label="额度对象"
            value={`${policy.scope}:${policy.scopeId}`}
            onChange={(e) => {
              const [scope, id] = e.target.value.split(':')
              setPolicy(
                policies.find((p) => p.scope === scope && p.scopeId === Number(id)) || {
                  ...blankPolicy,
                  scope,
                  scopeId: Number(id),
                  dailyLimit: null,
                  concurrentLimit: null,
                }
              )
            }}
          >
            <option value="default:0">默认个人额度</option>
            <option value="platform:0">全平台额度</option>
            {teams.map((t) => (
              <option key={`t${t.id}`} value={`team:${t.id}`}>
                团队 · {t.name}
              </option>
            ))}
            {users.map((u) => (
              <option key={`u${u.id}`} value={`user:${u.id}`}>
                个人 · {u.displayName || `用户 #${u.id}`}
              </option>
            ))}
          </select>
          {(
            [
              ['dailyLimit', '每日生成次数'],
              ['totalLimit', '总生成次数'],
              ['concurrentLimit', '同时生成任务数'],
              ['storageBytes', '存储额度（MB）'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block">
              {label}
              <input
                className="ys-field"
                type="number"
                min={0}
                step={1}
                value={
                  policy[key] === null
                    ? ''
                    : key === 'storageBytes'
                      ? policy[key]! / 1e6
                      : policy[key]!
                }
                onChange={(e) =>
                  setPolicy((p) => ({
                    ...p,
                    [key]:
                      e.target.value === ''
                        ? null
                        : Number(e.target.value) * (key === 'storageBytes' ? 1e6 : 1),
                  }))
                }
              />
            </label>
          ))}
          <button disabled={busy} className="ys-btn ys-btn-primary">
            保存额度
          </button>
        </form>
      )}
      {tab === 'recycle' && <RecyclePanel busy={busy} run={act} />}
      {tab === 'shares' && <PrivateApiPanel />}
      {tab === 'shares' && <ShareQuotaPanel busy={busy} run={act} />}
      {tab === 'imports' && <ImportPanel busy={busy} run={act} teams={teams} />}
    </main>
  )
}
function ImportPanel({
  busy,
  run,
  teams,
}: {
  busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
  teams: Team[]
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [subtitles, setSubtitles] = useState('')
  const [team, setTeam] = useState('')
  const [progress, setProgress] = useState(0)
  return (
    <form
      className="ys-sheet space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!file) return
        void run(async () => {
          setProgress(0)
          const ticket = await api('/api/protected/imports', {
            filename: file.name,
            bytes: file.size,
            contentType: file.type || 'audio/mpeg',
          })
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.open('PUT', ticket.uploadUrl)
            xhr.setRequestHeader('content-type', ticket.contentType)
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 80))
            }
            xhr.onload = () =>
              xhr.status < 300 ? resolve() : reject(new Error('上传失败，请检查网络和文件大小'))
            xhr.onerror = () => reject(new Error('上传网络中断'))
            xhr.send(file)
          })
          setProgress(85)
          await api(
            '/api/protected/imports',
            {
              ticketId: ticket.id,
              title: title || file.name,
              subtitles,
              teamId: team ? Number(team) : null,
            },
            'PUT'
          )
          setProgress(100)
          setFile(null)
        })
      }}
    >
      <h2 className="ys-title text-xl">导入已有音频</h2>
      <p className="text-sm text-ink-soft">
        MP3 / WAV，最大 50 MB。直接上传到私有存储，导入后转换为标准 MP3。可附上 LRC 或 SRT
        同步字幕。不会调用大模型或 TTS，默认仅自己可见。
      </p>
      <label className="block">
        音频文件
        <input
          className="ys-field"
          type="file"
          required
          accept=".mp3,.wav"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <label className="block">
        作品标题
        <input
          className="ys-field"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="block">
        LRC 或 SRT 字幕（可选）
        <textarea
          className="ys-field min-h-36"
          maxLength={100000}
          value={subtitles}
          onChange={(e) => setSubtitles(e.target.value)}
        />
      </label>
      <label className="block">
        使用团队存储额度（可选，不会自动共享）
        <select className="ys-field" value={team} onChange={(e) => setTeam(e.target.value)}>
          <option value="">个人</option>
          {teams
            .filter((t) => t.active)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </label>
      {busy && (
        <>
          <progress className="w-full" value={progress} max={100} />
          <p role="status">{progress < 85 ? `上传中 ${progress}%` : '正在校验音频与字幕…'}</p>
        </>
      )}
      <button className="ys-btn ys-btn-primary" disabled={busy || !file}>
        导入作品
      </button>
    </form>
  )
}

function ShareQuotaPanel({
  busy,
  run,
}: {
  busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const [data, setData] = useState<{
    shares: {
      id: number
      active: boolean
      allowReshare: boolean
      ownerUserId: number
      capability: string
      maxEpisodes: number
      usedEpisodes: number
      dailyLimit: number | null
      dailyUsed: number
      dailyOn: string | null
    }[]
    grants: {
      id: number
      capability: string
      maxEpisodes: number
      usedEpisodes: number
      dailyLimit: number | null
    }[]
    userId: number
    isAdmin: boolean
  } | null>(null)
  const [recipients, setRecipients] = useState<{ id: number; displayName: string | null }[]>([])
  const [shareTeams, setShareTeams] = useState<Team[]>([])
  const [target, setTarget] = useState('')
  const [capability, setCapability] = useState('llm')
  const [maxEpisodes, setMaxEpisodes] = useState(3)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const load = () =>
    api('/api/user/share-quotas')
      .then(setData)
      .catch((e) => setError(e.message))
  useEffect(() => {
    void load()
    void api('/api/user/api-shares')
      .then((d) => setRecipients(d.users))
      .catch((e) => setError(e.message))
    void api('/api/protected/teams')
      .then((d) => setShareTeams(d.teams.filter((t) => t.active)))
      .catch(() => undefined)
  }, [])
  return (
    <section className="ys-sheet space-y-4 p-5">
      <h2 className="ys-title text-xl">共享 API 每日额度</h2>
      <p className="text-sm text-ink-soft">
        先在设置里创建分享或授权，再在这里调整每日额度。留空不限量，0
        暂停；总额度、启停和转分享仍在设置里管理。Key 本身不会交给接收者。
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            const [kind, id] = target.split(':')
            await api(kind === 'team' ? '/api/user/team-api-share' : '/api/user/api-shares', {
              teamId: kind === 'team' ? Number(id) : undefined,
              recipientUserId: kind === 'user' ? Number(id) : undefined,
              capability,
              maxEpisodes,
            })
            await load()
          })
        }}
      >
        <h3 className="font-semibold">分享自己的私有 API</h3>
        <p className="text-xs text-ink-soft">
          团队分享会为当前成员分别创建授权；额度为每人上限，新加入成员需再次授权。转分享默认关闭。
        </p>
        <select
          className="ys-field"
          required
          aria-label="分享对象"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">选择同团队用户或团队</option>
          {recipients.map((u) => (
            <option key={`u${u.id}`} value={`user:${u.id}`}>
              {u.displayName || `用户 #${u.id}`}
            </option>
          ))}
          {shareTeams.map((t) => (
            <option key={`t${t.id}`} value={`team:${t.id}`}>
              团队 · {t.name}
            </option>
          ))}
        </select>
        <select
          className="ys-field"
          aria-label="分享能力"
          value={capability}
          onChange={(e) => setCapability(e.target.value)}
        >
          {SHARE_CAPABILITIES.map((c) => (
            <option key={c} value={c}>
              {CAPABILITY_LABELS[c]}
            </option>
          ))}
        </select>
        <label className="block">
          每人总次数
          <input
            className="ys-field"
            type="number"
            min={1}
            max={1000}
            value={maxEpisodes}
            onChange={(e) => setMaxEpisodes(Number(e.target.value))}
          />
        </label>
        <button disabled={busy} className="ys-btn ys-btn-primary">
          创建授权
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {data &&
        [
          ...data.shares.map((s) => ({
            ...s,
            kind: 'share' as const,
            canEdit: data.isAdmin || s.ownerUserId === data.userId,
          })),
          ...data.grants.map((s) => ({ ...s, kind: 'grant' as const, canEdit: data.isAdmin })),
        ].map((s) => {
          const key = `${s.kind}:${s.id}`
          return (
            <div key={key} className="flex flex-wrap items-center gap-3 border-t border-rule pt-3">
              <span className="flex-1">
                {s.kind === 'share' ? '成员分享' : '管理员授权'} #{s.id} · {s.capability} · 累计{' '}
                {s.usedEpisodes}/{s.maxEpisodes}
              </span>
              <label>
                每日上限
                <input
                  disabled={!s.canEdit || busy}
                  className="ys-field w-28"
                  type="number"
                  min={0}
                  max={10000}
                  value={draft[key] ?? (s.dailyLimit === null ? '' : String(s.dailyLimit))}
                  onChange={(e) => setDraft((v) => ({ ...v, [key]: e.target.value }))}
                />
              </label>
              {s.kind === 'share' && s.canEdit && (
                <>
                  <button
                    disabled={busy}
                    className="ys-btn-sm ys-btn-secondary"
                    onClick={() =>
                      void run(async () => {
                        await api(
                          '/api/user/api-shares',
                          { id: s.id, active: !s.active, maxEpisodes: s.maxEpisodes },
                          'PATCH'
                        )
                        await load()
                      })
                    }
                  >
                    {s.active ? '停用' : '启用'}
                  </button>
                  <label className="flex gap-2 text-sm">
                    <input
                      disabled={busy}
                      type="checkbox"
                      checked={s.allowReshare}
                      onChange={(e) =>
                        void run(async () => {
                          await api(
                            '/api/user/api-shares',
                            {
                              id: s.id,
                              active: s.active,
                              maxEpisodes: s.maxEpisodes,
                              allowReshare: e.target.checked,
                            },
                            'PATCH'
                          )
                          await load()
                        })
                      }
                    />
                    允许转分享
                  </label>
                </>
              )}
              {s.canEdit && (
                <button
                  disabled={busy}
                  className="ys-btn-sm ys-btn-secondary"
                  onClick={() =>
                    void run(async () => {
                      const value =
                        draft[key] ?? (s.dailyLimit === null ? '' : String(s.dailyLimit))
                      await api(
                        '/api/user/share-quotas',
                        { id: s.id, kind: s.kind, dailyLimit: value === '' ? null : Number(value) },
                        'PATCH'
                      )
                      await load()
                    })
                  }
                >
                  保存
                </button>
              )}
            </div>
          )
        })}
      {data && !data.shares.length && !data.grants.length && (
        <p>暂无 API 分享，在设置中创建后即可管理。</p>
      )}
    </section>
  )
}

function RecyclePanel({
  busy,
  run,
}: {
  busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const [items, setItems] = useState<{ uuid: string; title: string | null; deletedAt: string }[]>(
    []
  )
  const [error, setError] = useState('')
  const load = () =>
    api('/api/protected/recycle')
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
  useEffect(() => {
    void load()
  }, [])
  return (
    <section className="ys-sheet space-y-4 p-5">
      <h2 className="ys-title text-xl">回收站</h2>
      <p className="text-sm text-ink-soft">
        作品保留 7
        天，保留期内文件仍占用存储。保留期后自动清理。管理员可恢复所有作品，成员仅能恢复自己的。
      </p>
      {error && <p role="alert">{error}</p>}
      {items.map((i) => (
        <div key={i.uuid} className="flex items-center gap-3">
          <span className="flex-1">
            {i.title || i.uuid} · {new Date(i.deletedAt).toLocaleDateString()}
          </span>
          <button
            className="ys-btn-sm ys-btn-secondary"
            disabled={busy || Date.now() - Date.parse(i.deletedAt) > 7 * 86400000}
            onClick={() =>
              void run(async () => {
                await api('/api/protected/recycle', { uuid: i.uuid }, 'PATCH')
                await load()
              })
            }
          >
            恢复
          </button>
        </div>
      ))}
      {!items.length && !error && <p>回收站为空</p>}
    </section>
  )
}
