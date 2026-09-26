'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { EpisodeGrid, notifyEpisodesChanged, type EpisodeFilters } from './EpisodeGrid'
import { NewEpisodeDrawer } from './NewEpisodeDrawer'
import type { EpisodeListData } from '@/lib/podcast/list'
import type { LocaleTypes } from '@/i18n/settings'
import { getLocalePath } from '@/utils/locale-util'

type FolderOption = { path: string; label: string; depth: number; episodes: number }
const folderLabel = (path: string) => path.split('/').filter(Boolean).join(' / ')

// 工作台：侧栏（桌面）负责目录与范围，这里是标题、移动端筛选、卡片墙与新建抽屉。
export function UserPanel({ initialList, initialFilters }: { initialList: EpisodeListData; initialFilters: EpisodeFilters }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const locale = (useParams()?.locale || 'zh') as LocaleTypes
  const filters: EpisodeFilters = { scope: params.get('scope') || '', folder: params.get('folder') || '', status: params.get('status') || '' }
  const drawerOpen = params.get('new') === '1'
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [folders, setFolders] = useState<FolderOption[]>([])
  const isTeamMember = initialList.viewer.isTeamMember || initialList.viewer.isAdmin
  const isAdmin = initialList.viewer.isAdmin
  const usingInitial = filters.scope === initialFilters.scope && filters.folder === initialFilters.folder && filters.status === initialFilters.status

  useEffect(() => {
    fetch(`/api/protected/folders?${new URLSearchParams({ scope: filters.scope })}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : { folders: [] }).then(body => setFolders(body.folders || [])).catch(() => undefined)
  }, [filters.scope, refreshTrigger])

  const navigate = (next: Partial<EpisodeFilters & { new: string }>) => {
    const query = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) { if (value) query.set(key, value); else query.delete(key) }
    const string = query.toString()
    router.replace(string ? `${pathname}?${string}` : pathname, { scroll: false })
  }
  const openDrawer = () => navigate({ new: '1' })
  const closeDrawer = () => navigate({ new: '' })

  const title = filters.status === 'processing' ? '生成中' : filters.scope === 'team' ? '团队共享' : filters.folder ? folderLabel(filters.folder) : '节目库'
  const subtitle = filters.folder && filters.status !== 'processing' ? '目录' : filters.status === 'processing' ? '正在生成的节目' : filters.scope === 'team' ? '共享到团队的节目与我的节目' : '全部目录'

  return <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h1 className="ys-title text-2xl sm:text-[26px]">{title}</h1>
        <p className="text-sm text-ink-soft">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(isTeamMember || isAdmin) && <select aria-label="查看范围" value={filters.scope} onChange={event => navigate({ scope: event.target.value })} className="ys-field-sm min-h-10 w-auto pr-8">
          <option value="">{isAdmin ? '所有成员' : '团队与我的'}</option>
          <option value="mine">仅我的</option>
          {isTeamMember && <option value="team">团队与我的</option>}
        </select>}
        <select aria-label="按状态筛选" value={filters.status} onChange={event => navigate({ status: event.target.value })} className="ys-field-sm min-h-10 w-auto pr-8">
          <option value="">全部状态</option><option value="success">已完成</option>
          <option value="processing">生成中</option><option value="pending">排队中</option><option value="failed">失败</option>
        </select>
        <select aria-label="按目录筛选" value={filters.folder} onChange={event => navigate({ folder: event.target.value })} className="ys-field-sm min-h-10 w-auto max-w-[12rem] pr-8 lg:hidden">
          <option value="">所有目录</option>
          {folders.map(item => <option key={item.path} value={item.path}>{'— '.repeat(item.depth)}{item.label} · {item.episodes}</option>)}
        </select>
        <button type="button" onClick={openDrawer} className="ys-btn-sm ys-btn-primary min-h-10 lg:hidden"><Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />新建</button>
      </div>
    </div>

    <EpisodeGrid apiUrl="/api/protected/get-list" initialList={usingInitial ? initialList : undefined} filters={filters} refreshTrigger={refreshTrigger} onEmptyCreate={openDrawer} />

    <NewEpisodeDrawer open={drawerOpen} defaultFolder={filters.folder} onClose={closeDrawer} onCreated={() => {
      closeDrawer()
      setRefreshTrigger(value => value + 1)
      notifyEpisodesChanged()
      if (filters.status || filters.scope === 'team') router.replace(getLocalePath(locale, '/'))
    }} />
  </div>
}
