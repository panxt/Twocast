'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
type Account = {
  id: number
  role: string
  displayName: string | null
  disabled: boolean
  expiresAt: string
}
async function request(path: string, body?: unknown, method = 'PATCH') {
  const response = await fetch(
    path,
    body === undefined
      ? { cache: 'no-store' }
      : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
  )
  const data = await response.json().catch(() => ({ error: '服务暂时不可用' }))
  if (!response.ok) throw new Error(data.error || '操作失败')
  return data
}
export default function AccountManagement() {
  const [accounts, setAccounts] = useState<Account[]>([]),
    [superAdmin, setSuperAdmin] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState('')
  const load = useCallback(async () => {
    try {
      const d = await request('/api/admin/members')
      setAccounts(d.accounts)
      setSuperAdmin(d.isSuperAdmin)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  async function change(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
      await load()
      toast.success('已更新')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="ys-sheet space-y-4 p-5">
      <h2 className="ys-title text-xl">账号与角色</h2>
      <p className="text-sm text-ink-soft">
        超级管理员管理所有账号；管理员只能管理普通成员。超级管理员不可降权、停用或删除。登录码仅显示一次，请私下交给对应用户。
      </p>
      {error && <p role="alert">{error}</p>}
      {code && (
        <p role="status" className="ys-note break-all">
          新登录码：{code}
        </p>
      )}
      {accounts.map((a) => {
        const editable = superAdmin ? a.role !== 'super_admin' : a.role === 'member'
        return (
          <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-rule py-3">
            <span className="min-w-32">
              {a.displayName || `用户 #${a.id}`} ·{' '}
              {a.role === 'super_admin' ? '超级管理员' : a.role === 'admin' ? '管理员' : '成员'}
              {a.disabled ? ' · 已停用' : ''}
            </span>
            {superAdmin && a.role !== 'super_admin' && (
              <select
                aria-label={`用户 ${a.id} 的角色`}
                className="ys-field-sm w-auto"
                value={a.role}
                disabled={busy}
                onChange={(e) =>
                  void change(() =>
                    request('/api/admin/members', { userId: a.id, role: e.target.value })
                  )
                }
              >
                <option value="member">普通成员</option>
                <option value="admin">管理员</option>
              </select>
            )}
            {editable && (
              <>
                <button
                  className="ys-btn-sm ys-btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    const name = window.prompt('显示名称', a.displayName || '')
                    if (name !== null)
                      void change(() =>
                        request('/api/admin/members', { userId: a.id, displayName: name })
                      )
                  }}
                >
                  改名
                </button>
                <button
                  className="ys-btn-sm ys-btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    void change(() =>
                      request('/api/admin/members', { userId: a.id, disabled: !a.disabled })
                    )
                  }
                >
                  {a.disabled ? '启用' : '停用'}
                </button>
                <button
                  className="ys-btn-sm ys-btn-secondary"
                  disabled={busy || a.disabled}
                  onClick={() => {
                    if (window.confirm('重置后原登录码失效，要继续吗？'))
                      void change(async () => {
                        const d = await request(
                          '/api/admin/members/login-code',
                          { userId: a.id },
                          'POST'
                        )
                        setCode(d.code)
                      })
                  }}
                >
                  重置登录码
                </button>
                <button
                  className="ys-btn-sm ys-btn-secondary text-alert"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('删除空账号；有节目时仅停用并保留节目。要继续吗？'))
                      void change(() => request(`/api/admin/members?id=${a.id}`, {}, 'DELETE'))
                  }}
                >
                  删除
                </button>
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}
