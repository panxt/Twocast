'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Dialog, Transition } from '@headlessui/react'
import { toast } from 'sonner'
import { LoaderCircle, Search, X } from 'lucide-react'
import { useAudioPlayer } from '@/contexts/AudioPlayerContext'
import { TaskVO } from '@/lib/client-api/types/TaskVO'
import { TaskStatus } from '@/types/task'
import { getLocalePath } from '@/utils/locale-util'
import type { LocaleTypes } from '@/i18n/settings'
import type { EpisodeListData } from '@/lib/podcast/list'
import { EpisodeCard, titleOf } from './EpisodeCard'

export type EpisodeFilters = { scope: string; folder: string; status: string }
type FolderOption = { path: string; label: string; depth: number; episodes: number }
const PAGE_SIZE = 15

export const notifyEpisodesChanged = () => window.dispatchEvent(new Event('episodes:changed'))

// 节目库卡片墙：筛选来自 URL（侧栏）与工具条；每 5 秒轮询生成中的节目。
export function EpisodeGrid({ apiUrl, initialList, filters, refreshTrigger, onEmptyCreate }: {
  apiUrl: string; initialList?: EpisodeListData; filters: EpisodeFilters; refreshTrigger?: number; onEmptyCreate?: () => void
}) {
  const locale = (useParams()?.locale || 'zh') as LocaleTypes
  const { play, pause, resume, isPlaying, isLoading, currentTrack } = useAudioPlayer()
  const [items, setItems] = useState<TaskVO[]>(initialList?.items || [])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(initialList?.pagination.totalPages || 1)
  const [total, setTotal] = useState(initialList?.pagination.total || 0)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(Boolean(initialList?.viewer.isAdmin))
  const [viewerId, setViewerId] = useState(initialList?.viewer.userId || 0)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initialList)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [organizing, setOrganizing] = useState<TaskVO | null>(null)
  const [folders, setFolders] = useState<FolderOption[]>([])
  const initialQuery = JSON.stringify([apiUrl, 1, filters.status || 'all', '', filters.scope, filters.folder])
  const [loadedQuery, setLoadedQuery] = useState(initialList ? initialQuery : '')
  const [errorQuery, setErrorQuery] = useState('')
  const skipInitialFetch = useRef(Boolean(initialList))
  const status = filters.status || 'all'
  const currentQuery = JSON.stringify([apiUrl, page, status, query, filters.scope, filters.folder])
  const showingCurrent = loadedQuery === currentQuery && search === query
  const currentError = errorQuery === currentQuery ? loadError : ''
  const filtered = Boolean(query || filters.folder || filters.status || filters.scope)

  useEffect(() => { setPage(1) }, [filters.scope, filters.folder, filters.status])
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setQuery(search) }, 300)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    if (skipInitialFetch.current) { skipInitialFetch.current = false; return }
    let alive = true
    setLoading(true)
    setLoadError('')
    setErrorQuery('')
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), status, search: query, scope: filters.scope, folder: filters.folder })
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
        setViewerId(Number(body.data.viewer.userId) || 0)
      }
    }).catch(error => {
      if (alive && error.name !== 'AbortError') { setLoadError(error.message); setErrorQuery(currentQuery) }
    }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false; controller.abort() }
  }, [apiUrl, page, status, query, filters.scope, filters.folder, refreshTrigger, revision, currentQuery])
  useEffect(() => {
    if (!items.some(item => item.status === TaskStatus.Pending || item.status === TaskStatus.Processing)) return
    const timer = setTimeout(() => setRevision(value => value + 1), 5000)
    return () => clearTimeout(timer)
  }, [items])
  useEffect(() => {
    if (!organizing) return
    fetch(`/api/protected/folders?${new URLSearchParams({ scope: filters.scope })}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : { folders: [] }).then(body => setFolders(body.folders || [])).catch(() => undefined)
  }, [organizing, filters.scope])

  const bump = () => { setRevision(value => value + 1); notifyEpisodesChanged() }

  async function remove(task: TaskVO) {
    if (!window.confirm(`确定删除「${titleOf(task)}」？关联的音频、封面和上传文件也会删除。`)) return
    setBusy(task.uuid)
    try {
      const response = await fetch(`/api/protected/tasks/${task.uuid}`, { method: 'DELETE' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '删除失败')
      toast.success('已删除')
      bump()
    } catch (error) { toast.error(error instanceof Error ? error.message : '删除失败') }
    finally { setBusy(null) }
  }
  async function toggleSharing(task: TaskVO) {
    const next = task.visibility === 'team' ? 'private' : 'team'
    setBusy(task.uuid)
    try {
      const response = await fetch(`/api/protected/tasks/${task.uuid}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visibility: next }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '更新共享范围失败')
      toast.success(next === 'team' ? '已共享给团队' : '已设为仅自己可见')
      bump()
    } catch (error) { toast.error(error instanceof Error ? error.message : '更新共享范围失败') }
    finally { setBusy(null) }
  }
  async function saveOrganization(task: TaskVO, folderPath: string, labels: string[]) {
    setBusy(task.uuid)
    try {
      const response = await fetch(`/api/protected/tasks/${task.uuid}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ folderPath, labels }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || '保存失败')
      setOrganizing(null)
      toast.success('归档已保存')
      bump()
    } catch (error) { toast.error(error instanceof Error ? error.message : '保存失败') }
    finally { setBusy(null) }
  }
  function togglePlay(task: TaskVO) {
    if (!task.result?.audio_url) return
    if (currentTrack?.id === task.uuid) {
      if (isPlaying || isLoading) pause()
      else resume()
    } else play({ id: task.uuid, url: task.result.audio_url, title: titleOf(task), duration: task.result.duration, thumbnail: task.cover_url || undefined })
  }

  return <section aria-label="节目库" className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-soft">{showingCurrent ? `共 ${total} 期` : '正在查找节目…'}{loading && showingCurrent ? '，正在更新进度' : ''}</p>
      <label className="relative block w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
        <input type="search" aria-label="搜索节目" placeholder="搜索标题、原文件名或任务编号" value={search}
          onChange={event => setSearch(event.target.value)} className="ys-field min-h-10 pl-9" />
      </label>
    </div>

    {!showingCurrent && !currentError && <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-ink-soft">
      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />正在加载…
    </p>}
    {currentError && <p role="alert" className="ys-note bg-alert-tint text-center text-alert-deep">
      {currentError}。<button className="ml-1 font-semibold underline" onClick={() => setRevision(value => value + 1)}>重试</button>
    </p>}
    {showingCurrent && !loading && !currentError && items.length === 0 && <div className="ys-sheet flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-sm font-semibold text-ink">{filtered ? '没有匹配的节目' : '还没有节目'}</p>
      <p className="text-sm text-ink-soft">{filtered ? '换个关键词或目录试试。' : '给一段资料，第一期就会出现在这里。'}</p>
      {!filtered && onEmptyCreate && <button type="button" onClick={onEmptyCreate} className="ys-btn ys-btn-primary mt-2">新建节目</button>}
    </div>}

    {showingCurrent && items.length > 0 && <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(task => <EpisodeCard key={task.uuid} task={task}
        href={getLocalePath(locale, `/podcast/${task.uuid}`)}
        playing={currentTrack?.id === task.uuid && (isPlaying || isLoading)}
        busy={busy === task.uuid}
        canManage={isAdmin || task.user_id === viewerId}
        onPlay={() => togglePlay(task)}
        onShare={() => toggleSharing(task)}
        onOrganize={() => setOrganizing(task)}
        onDelete={() => remove(task)}
        onCoverChanged={coverUrl => setItems(current => current.map(item => item.uuid === task.uuid ? { ...item, cover_url: coverUrl } : item))}
      />)}
    </ul>}

    {showingCurrent && pages > 1 && <div className="flex items-center justify-end gap-2 text-sm text-ink-soft">
      <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1} className="ys-btn-sm ys-btn-secondary">上一页</button>
      <span className="tabular-nums">第 {page} 页，共 {pages} 页</span>
      <button onClick={() => setPage(value => Math.min(pages, value + 1))} disabled={page >= pages} className="ys-btn-sm ys-btn-secondary">下一页</button>
    </div>}

    <OrganizeDialog task={organizing} folders={folders} busy={busy === organizing?.uuid} onClose={() => setOrganizing(null)} onSave={saveOrganization} />
  </section>
}

function OrganizeDialog({ task, folders, busy, onClose, onSave }: {
  task: TaskVO | null; folders: FolderOption[]; busy: boolean; onClose: () => void; onSave: (task: TaskVO, folderPath: string, labels: string[]) => void
}) {
  const [folderDraft, setFolderDraft] = useState('/')
  const [labelsDraft, setLabelsDraft] = useState('')
  useEffect(() => {
    if (task) { setFolderDraft(task.folder_path || '/'); setLabelsDraft((task.labels || []).join(', ')) }
  }, [task])
  return <Transition show={Boolean(task)} as={Fragment}>
    <Dialog onClose={() => { if (!busy) onClose() }} className="relative z-50">
      <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-ink/40" aria-hidden="true" />
      </Transition.Child>
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Transition.Child as={Fragment} enter="ease-out duration-150" enterFrom="opacity-0 translate-y-2" enterTo="opacity-100 translate-y-0" leave="ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <Dialog.Panel as="form" onSubmit={(event: React.FormEvent) => { event.preventDefault(); if (task) onSave(task, folderDraft, labelsDraft.split(/[,，]/).map(label => label.trim()).filter(Boolean)) }}
            className="ys-sheet w-full max-w-md p-6 shadow-bar">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="ys-title text-xl">归档与标签</Dialog.Title>
                <p className="mt-1 truncate text-sm text-ink-soft">{task ? titleOf(task) : ''}</p>
              </div>
              <button type="button" onClick={onClose} disabled={busy} aria-label="关闭" className="ys-icon-btn h-9 w-9"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-sm font-semibold">目录</span>
              <input list="episode-folders" value={folderDraft} onChange={event => setFolderDraft(event.target.value)} placeholder="/财务/对账/" className="ys-field" />
              <datalist id="episode-folders"><option value="/" />{folders.map(item => <option key={item.path} value={item.path} />)}</datalist>
              <span className="text-xs text-ink-soft">形如 /目录/子目录/，输入新路径即新建目录。</span>
            </label>
            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-sm font-semibold">标签</span>
              <input value={labelsDraft} onChange={event => setLabelsDraft(event.target.value)} placeholder="用逗号分隔，最多 8 个" className="ys-field" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="ys-btn ys-btn-secondary">取消</button>
              <button type="submit" disabled={busy} className="ys-btn ys-btn-primary">{busy ? '保存中…' : '保存'}</button>
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition>
}
