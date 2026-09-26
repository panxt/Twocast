'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { Folder, LayoutGrid, LoaderCircle, PanelLeftClose, PanelLeftOpen, Plus, Settings, Users } from 'lucide-react'
import siteMetadata from '@/data/siteMetadata'
import ThemeSwitch from '@/components/theme/ThemeSwitch'
import type { LocaleTypes } from '@/i18n/settings'
import { getLocalePath } from '@/utils/locale-util'

type Me = { authenticated: boolean; isAdmin: boolean; isTeamMember: boolean; displayName: string }
type FolderOption = { path: string; label: string; depth: number; episodes: number }
const STORAGE_KEY = 'ys-sidebar-collapsed'
const WIDTH = { open: 236, collapsed: 68 }

// 桌面端左侧栏：新建入口、导航、目录树、当前成员。可收成图标栏，状态记在本地。
// 宽度写进 --ys-sidebar-w，底部播放条据此让出空间。
export default function Sidebar() {
  const locale = (useParams()?.locale || 'zh') as LocaleTypes
  const pathname = usePathname()
  const params = useSearchParams()
  const [me, setMe] = useState<Me | null>(null)
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [running, setRunning] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const home = getLocalePath(locale, '/')
  const settings = getLocalePath(locale, '/settings')
  const onEnterCode = pathname.endsWith('/enter-code')
  const scope = params.get('scope') || ''
  const folder = params.get('folder') || ''
  const status = params.get('status') || ''
  const onHome = pathname === home || pathname === '/'
  const visible = !onEnterCode && Boolean(me?.authenticated)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === '1') } catch { /* 无本地存储时保持展开 */ }
  }, [])
  useEffect(() => {
    const width = visible ? (collapsed ? WIDTH.collapsed : WIDTH.open) : 0
    document.documentElement.style.setProperty('--ys-sidebar-w', `${width}px`)
    return () => { document.documentElement.style.removeProperty('--ys-sidebar-w') }
  }, [visible, collapsed])

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

  if (!visible || !me) return null

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch { /* 忽略 */ }
  }
  const withQuery = (query: Record<string, string>) => {
    const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value))
    const string = search.toString()
    return string ? `${home}?${string}` : home
  }
  const navClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-control text-sm transition-colors ${collapsed ? 'h-10 w-10 justify-center' : 'px-2.5 py-2'} ${active ? 'bg-brand-tint font-semibold text-brand' : 'text-ink hover:bg-paper'}`
  const folderClass = (active: boolean) =>
    `flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${active ? 'bg-paper font-semibold text-ink' : 'text-ink hover:bg-paper'}`
  const items = [
    { key: 'all', href: home, label: '节目库', Icon: LayoutGrid, active: onHome && !scope && !status, badge: total !== null ? String(total) : '', show: true },
    { key: 'team', href: withQuery({ scope: 'team' }), label: '团队共享', Icon: Users, active: onHome && scope === 'team', badge: '', show: me.isTeamMember || me.isAdmin },
    { key: 'running', href: withQuery({ status: 'processing', scope }), label: '生成中', Icon: LoaderCircle, active: onHome && status === 'processing', badge: running ? String(running) : '', show: true },
    { key: 'settings', href: settings, label: '设置', Icon: Settings, active: pathname === settings, badge: '', show: true },
  ]

  return <aside style={{ width: collapsed ? WIDTH.collapsed : WIDTH.open }}
    className={`sticky top-0 hidden h-screen shrink-0 flex-col gap-5 overflow-y-auto overflow-x-hidden border-r border-rule bg-sheet py-5 transition-[width] duration-200 lg:flex ${collapsed ? 'items-center px-3' : 'px-4'}`}>
    <div className={`flex items-center ${collapsed ? 'flex-col gap-3' : 'justify-between gap-2 px-1.5'}`}>
      <Link href={home} className="flex min-w-0 items-center gap-2.5 text-ink" aria-label={siteMetadata.headerTitle} title={collapsed ? siteMetadata.headerTitle : undefined}>
        <img src={siteMetadata.siteLogo} alt="" className="h-8 w-8 shrink-0" />
        {!collapsed && <span className="min-w-0 leading-tight">
          <span className="ys-title block truncate text-lg">{siteMetadata.headerTitle}</span>
          <span className="block text-[11px] text-ink-soft">团队声音工作台</span>
        </span>}
      </Link>
      <button type="button" onClick={toggle} aria-label={collapsed ? '展开侧栏' : '收起侧栏'} aria-expanded={!collapsed} title={collapsed ? '展开侧栏' : '收起侧栏'}
        className="ys-icon-btn h-8 w-8 rounded-lg">
        {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>

    <Link href={withQuery({ new: '1', folder })} title={collapsed ? '新建节目' : undefined} aria-label="新建节目"
      className={`ys-btn ys-btn-primary ${collapsed ? 'h-10 w-10 min-h-0 px-0' : ''}`}>
      <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />{!collapsed && '新建节目'}
    </Link>

    <nav aria-label="主导航" className={`flex flex-col ${collapsed ? 'items-center gap-1' : 'gap-0.5'}`}>
      {items.filter(item => item.show).map(({ key, href, label, Icon, active, badge }) => (
        <Link key={key} href={href} aria-current={active ? 'page' : undefined} className={navClass(active)} title={collapsed ? label : undefined} aria-label={label}>
          <span className="relative">
            <Icon className={`h-4 w-4 ${key === 'running' && running ? 'animate-spin text-voice' : ''}`} aria-hidden="true" />
            {collapsed && badge && key === 'running' && <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-voice" aria-hidden="true" />}
          </span>
          {!collapsed && <>
            {label}
            {badge && <span className={`ml-auto text-xs tabular-nums ${key === 'running' ? 'rounded-full bg-voice-tint px-1.5 text-[11px] font-bold text-voice-deep' : 'text-ink-faint'}`}>{badge}</span>}
          </>}
        </Link>
      ))}
    </nav>

    {!collapsed && <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 px-2.5 pb-1 text-xs text-ink-soft"><Folder className="h-3.5 w-3.5" aria-hidden="true" />目录</span>
      <Link href={withQuery({ scope })} className={folderClass(onHome && !folder)}>
        <span>全部</span>{total !== null && <span className="text-xs tabular-nums text-ink-faint">{total}</span>}
      </Link>
      {folders.map(item => <Link key={item.path} href={withQuery({ folder: item.path, scope })} aria-current={folder === item.path ? 'page' : undefined}
        className={folderClass(onHome && folder === item.path)} style={{ paddingLeft: `${10 + item.depth * 12}px` }}>
        <span className="truncate">{item.label}</span><span className="text-xs tabular-nums text-ink-faint">{item.episodes}</span>
      </Link>)}
      {folders.length === 0 && <p className="px-2.5 py-1.5 text-xs text-ink-faint">还没有目录，归档节目时可以新建。</p>}
    </div>}
    {collapsed && <Link href={withQuery({ scope })} title="目录" aria-label="目录" className={navClass(onHome && Boolean(folder))}>
      <Folder className="h-4 w-4" aria-hidden="true" />
    </Link>}

    <div className={`mt-auto flex items-center gap-2.5 rounded-control bg-paper ${collapsed ? 'flex-col p-1.5' : 'p-2.5'}`}>
      <span aria-hidden="true" title={me.displayName || '成员'} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-voice-tint text-sm font-bold text-voice-deep">{(me.displayName || '成').slice(0, 1)}</span>
      {!collapsed && <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-semibold text-ink">{me.displayName || '成员'}</span>
        <span className="block text-[11px] text-ink-soft">{me.isAdmin ? '管理员' : me.isTeamMember ? '团队成员' : '体验用户'}</span>
      </span>}
      <ThemeSwitch compact />
    </div>
  </aside>
}
