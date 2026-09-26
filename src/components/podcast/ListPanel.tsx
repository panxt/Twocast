'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useParams } from 'next/navigation'
import { Menu, Transition } from '@headlessui/react'
import { Check, Ellipsis, FileText, Folder, LoaderCircle, Lock, Pause, Play, Search, TriangleAlert, Users } from 'lucide-react'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { TaskVO } from '@/lib/client-api/types/TaskVO'
import { TaskStatus } from '@/types/task'
import { getLocalePath } from '@/utils/locale-util'
import type { LocaleTypes } from '@/i18n/settings'
import { formatTime } from '@/utils/time'
import type { EpisodeListData } from '@/lib/podcast/list'
import { RouteProgress } from './RouteProgress'

interface ListPanelProps { refreshTrigger?: number; apiUrl: string; showPagination?: boolean; initialList?: EpisodeListData }
type FolderOption = { path: string; label: string; depth: number; episodes: number }
const titleOf = (task: TaskVO) => task.result?.title || task.user_inputs?.fileName || task.user_inputs?.text?.slice(0, 48) || '未命名节目'
const progressLabel = (task: TaskVO) => {
  if (task.status === TaskStatus.Pending) return '排队中，等待后台启动'
  if (task.progress?.stage === 'preparing') return '正在整理资料'
  if (task.progress?.stage === 'script') return '正在写脚本'
  if (task.progress?.stage === 'audio') return `正在配音，第 ${task.progress.current || 0} 段，共 ${task.progress.total || '?'} 段`
  if (task.progress?.stage === 'finalizing') return '正在合成音频与字幕'
  return '正在生成'
}
const progressPercent = (task: TaskVO) => task.progress?.stage === 'audio' && task.progress.total
  ? 100 * Math.min(task.progress.current || 0, task.progress.total) / task.progress.total : null
const folderLabel = (path?: string) => {
  const parts = (path || '/').split('/').filter(Boolean)
  return parts.length ? parts.join(' / ') : '未归档'
}
const dateLabel = (value?: Date | string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const time = date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `今天 ${time}`
  return date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

export function ListPanel({ refreshTrigger, apiUrl, showPagination = true, initialList }: ListPanelProps) {
  const locale = (useParams()?.locale || 'zh') as LocaleTypes
  const { play, pause, resume, isPlaying, isLoading, currentTrack } = useAudioPlayer()
  const [items, setItems] = useState<TaskVO[]>(initialList?.items || [])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(initialList?.pagination.totalPages || 1)
  const [total, setTotal] = useState(initialList?.pagination.total || 0)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('')
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [scope, setScope] = useState('')
  const [defaultScope, setDefaultScope] = useState(initialList?.viewer.scope || 'mine')
  const [viewerLoaded, setViewerLoaded] = useState(Boolean(initialList))
  const [isAdmin, setIsAdmin] = useState(Boolean(initialList?.viewer.isAdmin))
  const [isTeamMember, setIsTeamMember] = useState(Boolean(initialList?.viewer.isTeamMember))
  const [viewerId, setViewerId] = useState(initialList?.viewer.userId || 0)
  const [editing, setEditing] = useState<string | null>(null)
  const [folderDraft, setFolderDraft] = useState('/')
  const [labelsDraft, setLabelsDraft] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initialList)
  const [loadError, setLoadError] = useState('')
  const [loadedQuery, setLoadedQuery] = useState(initialList ? JSON.stringify([apiUrl, 1, 'all', '', '', '']) : '')
  const [errorQuery, setErrorQuery] = useState('')
  const [revision, setRevision] = useState(0)
  const [directoryRevision, setDirectoryRevision] = useState(0)
  const skipInitialFetch = useRef(Boolean(initialList))
  const currentQuery = JSON.stringify([apiUrl, page, status, query, scope, folder])
  const showingCurrent = loadedQuery === currentQuery && search === query
  const currentError = errorQuery === currentQuery ? loadError : ''
  const sharedCount = items.filter(item => item.visibility === 'team').length

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setQuery(search) }, 300)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    if (!viewerLoaded) return
    let alive = true
    fetch(`/api/protected/folders?${new URLSearchParams({ scope })}`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('目录加载失败')
        return response.json()
      }).then(body => { if (alive) setFolders(body.folders || []) })
      .catch(error => { if (alive) toast.error(error.message) })
    return () => { alive = false }
  }, [viewerLoaded, scope, refreshTrigger, directoryRevision])
  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    let alive = true
    setLoading(true)
    setLoadError('')
    setErrorQuery('')
    const params = new URLSearchParams({ page: String(page), page_size: '15', status, search: query, scope, folder })
    const controller = new AbortController()
    fetch(`${apiUrl}?${params}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('列表加载失败')
      return response.json()
    }).then(body => {
      if (!alive) return
      setItems(body.data.items)
      setPages(Math.max(1, body.data.pagination.totalPages))
      setTotal(body.data.pagination.total)
      setLoadedQuery(currentQuery)
      if (body.data.viewer) {
        setIsAdmin(Boolean(body.data.viewer.isAdmin))
        setIsTeamMember(Boolean(body.data.viewer.isTeamMember))
        setViewerId(Number(body.data.viewer.userId) || 0)
        setDefaultScope(body.data.viewer.scope || 'mine')
        setViewerLoaded(true)
      }
    }).catch(error => {
      if (alive && error.name !== 'AbortError') {
        setLoadError(error.message)
        setErrorQuery(currentQuery)
      }
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false; controller.abort() }
  }, [apiUrl, page, status, query, scope, folder, refreshTrigger, revision, currentQuery])
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
      setDirectoryRevision(value => value + 1)
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
      setDirectoryRevision(value => value + 1)
      toast.success('归档已保存')
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
      toast.success(next === 'team' ? '已共享给团队' : '已设为仅自己可见')
      setRevision(value => value + 1)
      setDirectoryRevision(value => value + 1)
    } catch (error) { toast.error(error instanceof Error ? error.message : '更新共享范围失败') }
    finally { setBusy(null) }
  }
  function togglePlay(task: TaskVO) {
    if (!task.result?.audio_url) return
    if (currentTrack?.id === task.uuid) {
      if (isPlaying || isLoading) pause()
      else resume()
    } else play({ id: task.uuid, url: task.result.audio_url, title: titleOf(task), duration: task.result.duration })
  }

  const menuItemClass = (active: boolean, danger = false) =>
    `flex w-full items-center rounded-lg px-2.5 py-2 text-sm ${active ? 'bg-paper' : ''} ${danger ? 'text-alert' : 'text-ink'} disabled:opacity-40`

  return <section id="episode-library" aria-label="节目库" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="ys-title text-xl sm:text-[22px]">节目库</h2>
        <p className="text-sm text-ink-soft">
          {showingCurrent ? `共 ${total} 期${sharedCount ? `，本页 ${sharedCount} 期已共享给团队` : ''}` : '正在查找节目…'}
          {loading && showingCurrent ? '，正在更新进度' : ''}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">查看
        <select aria-label="查看范围" value={scope || defaultScope} onChange={event => { setScope(event.target.value); setFolder(''); setPage(1) }}
          className="ys-field-sm w-auto pr-8 text-ink">
          <option value="mine">仅我的</option>
          {isTeamMember && <option value="team">团队与我的</option>}
          {isAdmin && <option value="all">所有成员（管理）</option>}
        </select>
      </label>
    </div>

    <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_9rem_10rem]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <input type="search" aria-label="搜索节目" placeholder="搜索标题、原文件名或任务编号" value={search}
          onChange={event => setSearch(event.target.value)} className="ys-field min-h-10 pl-9" />
      </label>
      <select aria-label="按状态筛选" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }} className="ys-field min-h-10 pr-8">
        <option value="all">全部状态</option><option value="success">已完成</option>
        <option value="failed">失败</option><option value="pending">排队中</option><option value="processing">生成中</option>
      </select>
      <select aria-label="按目录筛选" value={folder} onChange={event => { setFolder(event.target.value); setPage(1) }} className="ys-field min-h-10 pr-8">
        <option value="">所有目录</option>
        {folders.map(item => <option key={item.path} value={item.path}>
          {'— '.repeat(item.depth)}{item.label} · {item.episodes}
        </option>)}
      </select>
    </div>

    <ul className="ys-sheet divide-y divide-rule overflow-hidden">
      {!showingCurrent && !currentError && <li role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-ink-soft">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />正在加载当前筛选结果…
      </li>}
      {currentError && <li role="alert" className="px-5 py-6 text-center text-sm text-alert">
        {currentError}。{showingCurrent ? '下方是上次加载的结果。' : ''}
        <button className="ml-1 font-semibold underline" onClick={() => setRevision(value => value + 1)}>重试</button>
      </li>}
      {showingCurrent && !loading && !currentError && items.length === 0 && <li className="flex flex-col items-center gap-2 px-5 py-14 text-center">
        <p className="text-sm font-semibold text-ink">{query || status !== 'all' || folder ? '没有匹配的节目' : '还没有节目'}</p>
        <p className="text-sm text-ink-soft">{query || status !== 'all' || folder ? '换个关键词或放宽筛选试试。' : '在左侧给一段资料，第一期就会出现在这里。'}</p>
      </li>}
      {showingCurrent && items.map(task => {
        const running = task.status === TaskStatus.Pending || task.status === TaskStatus.Processing
        const failed = task.status === TaskStatus.Failed
        const current = currentTrack?.id === task.uuid
        const playing = current && (isPlaying || isLoading)
        const canManage = isAdmin || task.user_id === viewerId
        const percent = progressPercent(task)
        return <li key={task.uuid} className={`px-4 py-4 sm:px-5 ${running ? 'bg-sheet-raised' : ''}`}>
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:gap-x-4">
            {running
              ? <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full border-2 border-voice-rail text-voice">
                  <LoaderCircle className="h-[18px] w-[18px] animate-spin" />
                </span>
              : failed
                ? <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-alert-tint text-alert">
                    <TriangleAlert className="h-[18px] w-[18px]" />
                  </span>
                : <button type="button" onClick={() => togglePlay(task)} disabled={!task.result?.audio_url}
                    aria-label={playing ? `暂停 ${titleOf(task)}` : `播放 ${titleOf(task)}`}
                    className={`grid h-11 w-11 place-items-center rounded-full transition-colors ${playing ? 'bg-voice text-brand-on' : 'border border-rule bg-sheet text-brand hover:border-brand hover:bg-brand-tint'} disabled:opacity-40`}>
                    {playing ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden="true" />}
                  </button>}

            <div className="min-w-0 flex flex-col gap-1">
              {task.result?.audio_url
                ? <Link href={getLocalePath(locale, `/podcast/${task.uuid}`)} className="truncate text-[15px] font-semibold text-ink hover:text-brand">{titleOf(task)}</Link>
                : <span className="truncate text-[15px] font-semibold text-ink">{titleOf(task)}</span>}
              {!running && !failed && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                {task.folder_path && task.folder_path !== '/' && <span className="inline-flex items-center gap-1"><Folder className="h-3.5 w-3.5" aria-hidden="true" />{folderLabel(task.folder_path)}</span>}
                {task.visibility === 'team'
                  ? <span className="inline-flex items-center gap-1 text-voice"><Users className="h-3.5 w-3.5" aria-hidden="true" />团队共享</span>
                  : <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" aria-hidden="true" />仅自己可见</span>}
                {task.user_inputs?.fileName && <a href={`/api/protected/tasks/${task.uuid}/file`} onClick={event => event.stopPropagation()}
                  className="inline-flex min-w-0 max-w-[16rem] items-center gap-1 hover:text-brand"><FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{task.user_inputs.fileName}</span></a>}
                {task.labels?.map(label => <span key={label} className="ys-tag">{label}</span>)}
              </div>}
              {running && <div className="flex flex-col gap-1.5" role="status">
                <div className="flex items-center justify-between text-xs text-voice">
                  <span>{progressLabel(task)}</span>
                  {percent !== null && <span className="tabular-nums">{Math.round(percent)}%</span>}
                </div>
                <RouteProgress percent={percent} label={progressLabel(task)} />
              </div>}
              {failed && task.error && <p className="text-xs text-alert">{task.error}</p>}
            </div>

            <div className="col-start-2 flex items-center justify-between gap-3 sm:col-start-3 sm:justify-end">
              <div className="flex flex-col text-xs text-ink-soft sm:items-end">
                {task.result?.duration ? <span className="font-semibold tabular-nums text-ink">{formatTime(task.result.duration)}</span> : null}
                <span className="tabular-nums">{task.owner_name || '成员'} / {dateLabel(task.created_at)}</span>
              </div>
              {!running && <span className={`ys-pill ${failed ? 'bg-alert-tint text-alert-deep' : 'bg-voice-tint text-voice-deep'}`}>
                {failed ? <TriangleAlert className="h-3 w-3" aria-hidden="true" /> : <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
                {task.status_human}
              </span>}
              {canManage && <Menu as="div" className="relative">
                <Menu.Button aria-label={`${titleOf(task)} 的更多操作`} disabled={busy === task.uuid} className="ys-icon-btn h-9 w-9 border border-rule bg-sheet">
                  {busy === task.uuid ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ellipsis className="h-4 w-4" aria-hidden="true" />}
                </Menu.Button>
                <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="opacity-0 -translate-y-1" enterTo="opacity-100 translate-y-0"
                  leave="transition ease-in duration-75" leaveFrom="opacity-100" leaveTo="opacity-0">
                  <Menu.Items className="ys-sheet absolute right-0 z-30 mt-1.5 w-44 origin-top-right p-1 shadow-bar focus:outline-none">
                    <Menu.Item disabled={task.visibility !== 'team' && task.status !== TaskStatus.Success}>
                      {({ active }) => <button type="button" onClick={() => toggleSharing(task)} className={menuItemClass(active)}>
                        {task.visibility === 'team' ? '设为仅自己可见' : '共享给团队'}
                      </button>}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => <button type="button" className={menuItemClass(active)}
                        onClick={() => { setEditing(editing === task.uuid ? null : task.uuid); setFolderDraft(task.folder_path || '/'); setLabelsDraft((task.labels || []).join(', ')) }}>
                        归档到目录
                      </button>}
                    </Menu.Item>
                    <Menu.Item disabled={running}>
                      {({ active }) => <button type="button" onClick={() => remove(task)} className={menuItemClass(active, true)}>删除节目</button>}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>}
            </div>
          </div>

          {editing === task.uuid && <form onSubmit={event => { event.preventDefault(); saveOrganization(task.uuid) }}
            className="mt-3 grid gap-2 rounded-control bg-paper p-3 sm:ml-[3.75rem] sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="ys-label">目录</span>
              <input value={folderDraft} onChange={event => setFolderDraft(event.target.value)} placeholder="/财务/对账/" className="ys-field-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="ys-label">标签</span>
              <input value={labelsDraft} onChange={event => setLabelsDraft(event.target.value)} placeholder="用逗号分隔" className="ys-field-sm" />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy === task.uuid} className="ys-btn-sm ys-btn-primary">保存归档</button>
              <button type="button" onClick={() => setEditing(null)} className="ys-btn-sm ys-btn-secondary">取消</button>
            </div>
          </form>}
        </li>
      })}
    </ul>

    {showPagination && showingCurrent && pages > 1 && <div className="flex items-center justify-end gap-2 text-sm text-ink-soft">
      <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} className="ys-btn-sm ys-btn-secondary">上一页</button>
      <span className="tabular-nums">第 {page} 页，共 {pages} 页</span>
      <button onClick={() => setPage(value => Math.min(pages, value + 1))} disabled={page >= pages} className="ys-btn-sm ys-btn-secondary">下一页</button>
    </div>}
  </section>
}
