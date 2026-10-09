'use client'
import { useEffect, useRef, useState } from 'react'
import { getJson } from '@/lib/client-api/get-json'
type Ticket = {
  id: string
  title: string
  content?: string
  status: string
  author_name: string
  updated_at: string
  attachments?: { name: string; url: string }[]
}
type Detail = {
  ticket: Ticket
  messages: {
    id: string
    author_name: string
    is_admin: boolean
    content: string
    created_at: string
  }[]
}
const labels: Record<string, string> = { open: '待处理', processing: '处理中', closed: '已关闭' }
const date = (value: string) =>
  new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
async function send(path: string, method: string, body: FormData | object) {
  const form = body instanceof FormData
  const response = await fetch(path, {
    method,
    body: form ? body : JSON.stringify(body),
    headers: form ? undefined : { 'content-type': 'application/json' },
  })
  const data = await response.json().catch(() => {
    throw new Error('服务暂时未响应，请刷新工单历史确认是否已提交')
  })
  if (!response.ok) throw new Error(data.error || '操作失败')
  return data
}
export default function FeedbackConsole({ isAdmin }: { isAdmin: boolean }) {
  const [scope, setScope] = useState('mine'),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0)
  const [tickets, setTickets] = useState<Ticket[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [reply, setReply] = useState('')
  const [files, setFiles] = useState<File[]>([]),
    [fileError, setFileError] = useState('')
  const createForm = useRef<HTMLFormElement>(null)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    getJson(`/api/protected/feedback?scope=${scope}&page=${page}`)
      .then((data) => {
        if (alive) {
          setTickets(data.tickets)
          setTotal(data.total)
        }
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [scope, page, refresh])
  useEffect(() => {
    let alive = true
    setDetail(null)
    setReply('')
    if (selected)
      getJson<Detail>(`/api/protected/feedback/${selected}`)
        .then((data) => {
          if (alive) setDetail(data)
        })
        .catch((e) => {
          if (alive) setError(e.message)
        })
    return () => {
      alive = false
    }
  }, [selected, refresh])
  async function action(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await fn()
      setRefresh((n) => n + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络连接失败，请重试')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="ys-title text-3xl">问题反馈</h1>
          <p className="mt-2 text-sm text-ink-soft">
            工单仅提交者与管理员可见，可在这里查看处理回复。
          </p>
        </div>
        <button className="ys-btn-sm" onClick={() => setRefresh((n) => n + 1)} disabled={busy}>
          刷新
        </button>
      </div>
      {error && (
        <div role="alert" className="rounded-lg border border-alert p-3 text-alert">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="text-brand">
          {notice}
        </p>
      )}
      <details className="ys-sheet p-5" open={!selected}>
        <summary className="cursor-pointer font-semibold">提交新问题</summary>
        <form
          ref={createForm}
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (fileError) return
            const form = new FormData(e.currentTarget)
            form.delete('images')
            files.forEach((f) => form.append('images', f))
            void action(async () => {
              const data = await send('/api/protected/feedback', 'POST', form)
              createForm.current?.reset()
              setFiles([])
              setSelected(data.id)
              setPage(1)
              setNotice('已提交，我们会在工单中回复')
            })
          }}
        >
          <label className="block">
            标题
            <input
              name="title"
              required
              maxLength={120}
              className="ys-input mt-1 w-full"
              placeholder="用一句话描述问题"
            />
          </label>
          <label className="block">
            问题描述
            <textarea
              name="content"
              required
              maxLength={10000}
              rows={5}
              className="ys-input mt-1 w-full"
              placeholder="发生在哪个页面？操作步骤、预期结果和实际结果分别是什么？"
            />
          </label>
          <label className="block">
            截图（可选）
            <input
              name="images"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="mt-2 block w-full text-sm"
              onChange={(e) => {
                const next = Array.from(e.target.files || [])
                setFiles(next)
                setFileError(
                  next.length > 3 || next.reduce((n, f) => n + f.size, 0) > 3145728
                    ? '最多 3 张图片，合计不超过 3 MB'
                    : next.some((f) => !['image/png', 'image/jpeg', 'image/webp'].includes(f.type))
                      ? '仅支持 PNG、JPEG、WebP 图片'
                      : ''
                )
              }}
            />
          </label>
          <p className="text-xs text-ink-soft">
            仅支持 PNG / JPEG / WebP，最多 3 张、合计 3 MB；不支持视频。请遮盖 API
            Key、登录码和敏感资料。24 小时最多新建 20 个工单。
          </p>
          {fileError && (
            <p role="alert" className="text-alert">
              {fileError}
            </p>
          )}
          <button className="ys-btn ys-btn-primary" disabled={busy || !!fileError}>
            {busy ? '正在提交…' : '提交问题'}
          </button>
        </form>
      </details>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section className="ys-sheet p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{scope === 'all' ? '全部工单' : '我的反馈'}</h2>
            {isAdmin && (
              <select
                aria-label="工单范围"
                className="ys-input"
                value={scope}
                disabled={busy}
                onChange={(e) => {
                  setScope(e.target.value)
                  setPage(1)
                  setSelected(null)
                }}
              >
                <option value="mine">我的反馈</option>
                <option value="all">全部工单</option>
              </select>
            )}
          </div>
          {loading ? (
            <p role="status">正在加载…</p>
          ) : tickets.length === 0 ? (
            <p className="text-ink-soft">暂无反馈</p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    disabled={busy}
                    aria-pressed={selected === t.id}
                    onClick={() => {
                      setSelected(t.id)
                      setError('')
                    }}
                    className={`w-full rounded-lg border p-3 text-left ${selected === t.id ? 'border-brand bg-brand-tint' : 'border-rule'}`}
                  >
                    <span className="block break-words font-medium">{t.title}</span>
                    <span className="mt-1 block text-xs text-ink-soft">
                      {labels[t.status]} · {t.author_name}
                      <br />
                      {date(t.updated_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between text-sm">
            <button disabled={page <= 1 || busy || loading} onClick={() => setPage((n) => n - 1)}>
              上一页
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil(total / 20))}
            </span>
            <button
              disabled={page * 20 >= total || busy || loading}
              onClick={() => setPage((n) => n + 1)}
            >
              下一页
            </button>
          </div>
        </section>
        <section className="ys-sheet min-w-0 space-y-4 p-5">
          {!selected ? (
            <p className="text-ink-soft">选择工单，查看内容和处理历史。</p>
          ) : !detail ? (
            <p role="status">正在加载工单…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="ys-title break-words text-xl">{detail.ticket.title}</h2>
                <span className="text-sm text-brand">{labels[detail.ticket.status]}</span>
              </div>
              <p className="text-xs text-ink-soft">
                {detail.ticket.author_name} · 工单 {detail.ticket.id.slice(0, 8)}
              </p>
              <p className="whitespace-pre-wrap break-words">{detail.ticket.content}</p>
              <div className="flex flex-wrap gap-3">
                {detail.ticket.attachments?.map((a) => (
                  <a
                    key={a.url}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`打开截图 ${a.name}`}
                  >
                    <img
                      src={a.url}
                      alt={a.name}
                      className="h-32 max-w-full rounded-lg border border-rule object-contain"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
              <h3 className="border-t border-rule pt-4 font-semibold">回复与处理记录</h3>
              {detail.messages.length === 0 && (
                <p className="text-sm text-ink-soft">等待管理员处理。</p>
              )}
              <ol className="space-y-3">
                {detail.messages.map((m) => (
                  <li key={m.id} className="rounded-lg bg-paper p-3">
                    <p className="text-xs text-ink-soft">
                      {m.author_name}
                      {m.is_admin ? ' · 管理员' : ''} · {date(m.created_at)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words">{m.content}</p>
                  </li>
                ))}
              </ol>
              {detail.ticket.status !== 'closed' ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void action(async () => {
                      await send(`/api/protected/feedback/${selected}`, 'POST', { content: reply })
                      setReply('')
                      setNotice('回复已保存')
                    })
                  }}
                >
                  <label className="block">
                    {isAdmin ? '回复用户' : '补充说明'}
                    <textarea
                      required
                      maxLength={10000}
                      rows={3}
                      className="ys-input mt-1 w-full"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                    />
                  </label>
                  <button disabled={busy} className="ys-btn-sm ys-btn-primary">
                    {busy ? '保存中…' : '发送回复'}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-ink-soft">
                  工单已关闭，记录保留。管理员可重新打开后继续沟通。
                </p>
              )}
              {isAdmin && (
                <div className="flex flex-wrap gap-2 border-t border-rule pt-4">
                  {['open', 'processing', 'closed']
                    .filter((s) => s !== detail.ticket.status)
                    .map((s) => (
                      <button
                        key={s}
                        disabled={busy}
                        className="ys-btn-sm"
                        onClick={() =>
                          void action(async () => {
                            await send(`/api/protected/feedback/${selected}`, 'PATCH', {
                              status: s,
                            })
                            setNotice('工单状态已更新')
                          })
                        }
                      >
                        {s === 'open' ? '重新打开' : s === 'processing' ? '开始处理' : '关闭工单'}
                      </button>
                    ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
