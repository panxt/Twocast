'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { TaskVO } from '@/lib/client-api/types/TaskVO'
import { TaskStatus } from '@/types/task'
import { getLocalePath } from '@/utils/locale-util'
import { formatDuration } from '@/utils/time'

interface ListPanelProps { refreshTrigger?: number; apiUrl: string; showPagination?: boolean }
const titleOf = (task: TaskVO) => task.result?.title || task.user_inputs?.fileName || task.user_inputs?.text?.slice(0, 48) || '未命名播客'

export function ListPanel({ refreshTrigger, apiUrl, showPagination = true }: ListPanelProps) {
  const { i18n } = useTranslation()
  const { play, pause, isPlaying, currentTrack } = useAudioPlayer()
  const [items, setItems] = useState<TaskVO[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('')
  const [scope, setScope] = useState('mine')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isTeamMember, setIsTeamMember] = useState(false)
  const [viewerId, setViewerId] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [folderDraft, setFolderDraft] = useState('/')
  const [labelsDraft, setLabelsDraft] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me').then(response => response.json()).then(data => {
      setIsAdmin(Boolean(data.isAdmin))
      setIsTeamMember(Boolean(data.isTeamMember))
      setViewerId(Number(data.userId) || 0)
      if (data.isAdmin) setScope('all')
      else if (data.isTeamMember) setScope('team')
    }).catch(() => undefined)
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setQuery(search) }, 300)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    let alive = true
    const params = new URLSearchParams({ page: String(page), page_size: '15', status, search: query, scope, folder })
    fetch(`${apiUrl}?${params}`, { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('列表加载失败')
      return response.json()
    }).then(body => {
      if (!alive) return
      setItems(body.data.items)
      setPages(Math.max(1, body.data.pagination.totalPages))
      setTotal(body.data.pagination.total)
    }).catch(error => { if (alive) toast.error(error.message) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [apiUrl, page, status, query, scope, folder, refreshTrigger, revision])
  useEffect(() => {
    if (!items.some(item => item.status === TaskStatus.Pending || item.status === TaskStatus.Processing)) return
    const timer = setTimeout(() => setRevision(value => value + 1), 5000)
    return () => clearTimeout(timer)
  }, [items])

  async function remove(task: TaskVO) {
    if (!window.confirm(`确定删除「${titleOf(task)}」？关联的音频和上传文件也会删除。`)) return
    setBusy(task.uuid)
    try {
      const response = await fetch(`/api/protected/tasks/${task.uuid}`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '删除失败')
      toast.success('已删除')
      setRevision(value => value + 1)
    } catch (error) { toast.error(error instanceof Error ? error.message : '删除失败') }
    finally { setBusy(null) }
  }
  async function saveOrganization(uuid: string) {
    setBusy(uuid)
    try {
      const response = await fetch(`/api/protected/tasks/${uuid}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ folderPath: folderDraft, labels: labelsDraft.split(',').map(label => label.trim()).filter(Boolean) }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '保存失败')
      setEditing(null)
      setRevision(value => value + 1)
      toast.success('分类已保存')
    } catch (error) { toast.error(error instanceof Error ? error.message : '保存失败') }
    finally { setBusy(null) }
  }
  async function toggleSharing(task: TaskVO) {
    const next = task.visibility === 'team' ? 'private' : 'team'
    setBusy(task.uuid)
    try {
      const response = await fetch(`/api/protected/tasks/${task.uuid}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '更新共享范围失败')
      toast.success(next === 'team' ? '已共享给团队成员' : '已设为仅自己可见')
      setRevision(value => value + 1)
    } catch (error) { toast.error(error instanceof Error ? error.message : '更新共享范围失败') }
    finally { setBusy(null) }
  }
  function togglePlay(task: TaskVO) {
    if (!task.result?.audio_url) return
    if (isPlaying && currentTrack?.id === task.uuid) pause()
    else play({ id: task.uuid, url: task.result.audio_url, title: titleOf(task), duration: task.result.duration })
  }

  const folders = Array.from(new Set(items.map(item => item.folder_path || '/'))).sort()
  return <section className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/80 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="text-xl font-semibold text-gray-900 dark:text-white">音频与文件</h2>
        <p className="mt-1 text-sm text-gray-500">共 {total} 条 · 私人内容仅自己和管理员可见，共享节目供团队查看</p></div>
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">查看范围
        <select aria-label="查看范围" value={scope} onChange={event => { setScope(event.target.value); setPage(1) }}
          className="rounded-lg border px-3 py-2 dark:bg-gray-800">
          <option value="mine">仅我的</option>
          {isTeamMember && <option value="team">团队与我的</option>}
          {isAdmin && <option value="all">所有成员（管理）</option>}
        </select>
      </label>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
      <input aria-label="搜索音频" placeholder="搜索标题、原文件名或任务编号" value={search}
        onChange={event => setSearch(event.target.value)} className="rounded-lg border px-3 py-2 text-sm dark:bg-gray-800" />
      <select aria-label="按状态筛选" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}
        className="rounded-lg border px-3 py-2 text-sm dark:bg-gray-800">
        <option value="all">全部状态</option><option value="success">已完成</option>
        <option value="failed">失败</option><option value="pending">等待中</option><option value="processing">生成中</option>
      </select>
      <div>
        <input aria-label="按目录筛选" list="podcast-folder-suggestions" placeholder="目录，如 /资料/" value={folder}
          onChange={event => { setFolder(event.target.value); setPage(1) }}
          className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800" />
        <datalist id="podcast-folder-suggestions">{folders.map(path => <option key={path} value={path} />)}</datalist>
      </div>
    </div>
    <div className="mt-5 divide-y divide-gray-200 dark:divide-gray-700">
      {loading && <p className="py-10 text-center text-sm text-gray-500">正在加载…</p>}
      {!loading && items.length === 0 && <p className="py-10 text-center text-sm text-gray-500">没有匹配的记录</p>}
      {items.map(task => <div key={task.uuid} className="py-4">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => togglePlay(task)} disabled={!task.result?.audio_url}
            aria-label={isPlaying && currentTrack?.id === task.uuid ? '暂停' : '播放'}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-600 text-white disabled:bg-gray-300">
            {isPlaying && currentTrack?.id === task.uuid ? 'Ⅱ' : '▶'}</button>
          <div className="min-w-0 flex-1">
            <Link href={getLocalePath(i18n.language, `/podcast/${task.uuid}`)}
              className="block truncate font-medium text-gray-900 hover:text-indigo-600 dark:text-white">{titleOf(task)}</Link>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <span>{task.owner_name || '用户'}</span><span>{task.folder_path || '/'}</span>
              <span>{task.visibility === 'team' ? '团队共享' : '仅自己可见'}</span>
              <span>{task.created_at ? new Date(task.created_at).toLocaleString() : ''}</span>
              {task.result?.duration && <span>{formatDuration(task.result.duration)}</span>}
              {task.user_inputs?.fileName && <a href={`/api/protected/tasks/${task.uuid}/file`}
                className="text-indigo-600 hover:underline" onClick={event => event.stopPropagation()}>原文件：{task.user_inputs.fileName}</a>}
            </div>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs ${task.status === TaskStatus.Failed ? 'bg-red-100 text-red-700' : task.status === TaskStatus.Success ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{task.status_human}</span>
          {(isAdmin || task.user_id === viewerId) && <>
            <button onClick={() => toggleSharing(task)} disabled={busy === task.uuid || (task.visibility !== 'team' && task.status !== TaskStatus.Success)}
              className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm text-indigo-700 disabled:opacity-40 dark:text-indigo-300">
              {task.visibility === 'team' ? '设为私有' : '共享给团队'}
            </button>
            <button onClick={() => { setEditing(editing === task.uuid ? null : task.uuid); setFolderDraft(task.folder_path || '/'); setLabelsDraft((task.labels || []).join(', ')) }} className="rounded-lg border px-3 py-1.5 text-sm">分类</button>
            <button onClick={() => remove(task)} disabled={busy === task.uuid || task.status === TaskStatus.Pending || task.status === TaskStatus.Processing}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 disabled:opacity-40">删除</button>
          </>}
        </div>
        {(task.labels?.length || 0) > 0 && <div className="ml-14 mt-2 flex flex-wrap gap-1">{task.labels?.map(label => <span key={label} className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">{label}</span>)}</div>}
        {task.status === TaskStatus.Failed && task.error && <p className="ml-14 mt-2 text-xs text-red-600">{task.error}</p>}
        {editing === task.uuid && <div className="ml-14 mt-3 grid gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800 sm:grid-cols-[1fr_1fr_auto]">
          <input aria-label="目录路径" value={folderDraft} onChange={event => setFolderDraft(event.target.value)} placeholder="/资料/科技/" className="rounded border px-2 py-1 text-sm dark:bg-gray-900" />
          <input aria-label="标签" value={labelsDraft} onChange={event => setLabelsDraft(event.target.value)} placeholder="标签，用逗号分隔" className="rounded border px-2 py-1 text-sm dark:bg-gray-900" />
          <button onClick={() => saveOrganization(task.uuid)} disabled={busy === task.uuid} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white">保存</button>
        </div>}
      </div>)}
    </div>
    {showPagination && <div className="mt-5 flex items-center justify-end gap-3 text-sm">
      <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} className="rounded border px-3 py-1 disabled:opacity-40">上一页</button>
      <span>{page} / {pages}</span>
      <button onClick={() => setPage(value => Math.min(pages, value + 1))} disabled={page >= pages} className="rounded border px-3 py-1 disabled:opacity-40">下一页</button>
    </div>}
  </section>
}
