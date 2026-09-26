'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { Folder, LayoutGrid, LoaderCircle, Plus, Settings, Users } from 'lucide-react'
import siteMetadata from '@/data/siteMetadata'
import ThemeSwitch from '@/components/theme/ThemeSwitch'
import type { LocaleTypes } from '@/i18n/settings'
import { getLocalePath } from '@/utils/locale-util'

type Me = { authenticated: boolean; isAdmin: boolean; isTeamMember: boolean; displayName: string }
type FolderOption = { path: string; label: string; depth: number; episodes: number }

// 桌面端左侧栏：新建入口、导航、目录树、当前成员。未登录或进入页不渲染。
export default function Sidebar() {
  const locale = (useParams()?.locale || 'zh') as LocaleTypes
  const pathname = usePathname()
  const params = useSearchParams()
  const [me, setMe] = useState<Me | null>(null)
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [running, setRunning] = useState(0)
  const home = getLocalePath(locale, '/')
  const settings = getLocalePath(locale, '/settings')
  const onEnterCode = pathname.endsWith('/enter-code')
  const scope = params.get('scope') || ''
  const folder = params.get('folder') || ''
  const status = params.get('status') || ''
  const onHome = pathname === home || pathname === '/'

  useEffect(() => {
    if (onEnterCode) return
    let alive = true
    fetch('/api/auth/me', { cache: 'no-store' }).then(response => response.json())
      .then(data => { if (alive) setMe(data.authenticated ? data : null) })
      .catch(() => { if (alive) setMe(null) })
    return () => { alive = false }
  }, [onEnterCode, pathname])

  useEffect(() => {
    if (!me?.authenticated) return
    let alive = true
    const load = () => {
      fetch(`/api/protected/folders?${new URLSearchParams({ scope })}`, { cache: 'no-store' })
        .then(response => response.ok ? response.json() : { folders: [] })
        .then(body => { if (alive) setFolders(body.folders || []) }).catch(() => undefined)
      fetch(`/api/protected/get-list?${new URLSearchParams({ page: '1', page_size: '1', status: 'all', search: '', scope, folder: '' })}`, { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(body => { if (alive && body?.data) setTotal(body.data.pagination.total) }).catch(() => undefined)
      fetch(`/api/protected/get-list?${new URLSearchParams({ page: '1', page_size: '1', status: 'processing', search: '', scope, folder: '' })}`, { cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(body => { if (alive && body?.data) setRunning(body.data.pagination.total) }).catch(() => undefined)
    }
    load()
    const listener = () => load()
    window.addEventListener('episodes:changed', listener)
    return () => { alive = false; window.removeEventListener('episodes:changed', listener) }
  }, [me?.authenticated, scope])

  if (onEnterCode || !me?.authenticated) return null

  const navClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm transition-colors ${active ? 'bg-brand-tint font-semibold text-brand' : 'text-ink hover:bg-paper'}`
  const folderClass = (active: boolean) =>
    `flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${active ? 'bg-paper font-semibold text-ink' : 'text-ink hover:bg-paper'}`
  const withQuery = (query: Record<string, string>) => {
    const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value))
    const string = search.toString()
    return string ? `${home}?${string}` : home
  }

  return <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-rule bg-sheet px-4 py-5 lg:flex">
    <Link href={home} className="flex items-center gap-2.5 px-1.5 text-ink" aria-label={siteMetadata.headerTitle}>
      <img src={siteMetadata.siteLogo} alt="" className="h-8 w-8" />
      <span className="leading-tight">
        <span className="ys-title block text-lg">{siteMetadata.headerTitle}</span>
        <span className="block text-[11px] text-ink-soft">团队声音工作台</span>
      </span>
    </Link>

    <Link href={withQuery({ new: '1', folder })} className="ys-btn ys-btn-primary">
      <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />新建节目
    </Link>

    <nav aria-label="主导航" className="flex flex-col gap-0.5">
      <Link href={home} aria-current={onHome && !scope && !status ? 'page' : undefined} className={navClass(onHome && !scope && !status)}>
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />节目库
        {total !== null && <span className="ml-auto text-xs tabular-nums text-ink-faint">{total}</span>}
      </Link>
      {(me.isTeamMember || me.isAdmin) && <Link href={withQuery({ scope: 'team' })} aria-current={onHome && scope === 'team' ? 'page' : undefined} className={navClass(onHome && scope === 'team')}>
        <Users className="h-4 w-4" aria-hidden="true" />团队共享
      </Link>}
      <Link href={withQuery({ status: 'processing', scope })} aria-current={onHome && status === 'processing' ? 'page' : undefined} className={navClass(onHome && status === 'processing')}>
        <LoaderCircle className={`h-4 w-4 ${running ? 'animate-spin text-voice' : ''}`} aria-hidden="true" />生成中
        {running > 0 && <span className="ml-auto rounded-full bg-voice-tint px-1.5 text-[11px] font-bold tabular-nums text-voice-deep">{running}</span>}
      </Link>
      <Link href={settings} aria-current={pathname === settings ? 'page' : undefined} className={navClass(pathname === settings)}>
        <Settings className="h-4 w-4" aria-hidden="true" />设置
      </Link>
    </nav>

    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 px-2.5 pb-1 text-xs text-ink-soft"><Folder className="h-3.5 w-3.5" aria-hidden="true" />目录</span>
      <Link href={withQuery({ scope })} className={folderClass(onHome && !folder)}>
        <span>全部</span>{total !== null && <span className="text-xs tabular-nums text-ink-faint">{total}</span>}
      </Link>
      {folders.map(item => <Link key={item.path} href={withQuery({ folder: item.path, scope })} aria-current={folder === item.path ? 'page' : undefined}
        className={folderClass(onHome && folder === item.path)} style={{ paddingLeft: `${10 + item.depth * 12}px` }}>
        <span className="truncate">{item.label}</span><span className="text-xs tabular-nums text-ink-faint">{item.episodes}</span>
      </Link>)}
      {folders.length === 0 && <p className="px-2.5 py-1.5 text-xs text-ink-faint">还没有目录，归档节目时可以新建。</p>}
    </div>

    <div className="mt-auto flex items-center gap-2.5 rounded-control bg-paper p-2.5">
      <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-voice-tint text-sm font-bold text-voice-deep">{(me.displayName || '成').slice(0, 1)}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-semibold text-ink">{me.displayName || '成员'}</span>
        <span className="block text-[11px] text-ink-soft">{me.isAdmin ? '管理员' : me.isTeamMember ? '团队成员' : '体验用户'}</span>
      </span>
      <ThemeSwitch compact />
    </div>
  </aside>
}
