'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import siteMetadata from '@/data/siteMetadata'
import Link from './mdxcomponents/Link'
import ThemeSwitch from './theme/ThemeSwitch'
import type { LocaleTypes } from '@/i18n/settings'
import { getLocalePath } from '@/utils/locale-util'

export default function Header() {
  const locale = useParams()?.locale as LocaleTypes
  const pathname = usePathname()
  const home = getLocalePath(locale, '/')
  const settings = getLocalePath(locale, '/settings')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    let alive = true
    fetch('/api/auth/me', { cache: 'no-store' }).then(response => response.json())
      .then(me => { if (alive && me.authenticated) setDisplayName(me.displayName || '成员') })
      .catch(() => undefined)
    return () => { alive = false }
  }, [pathname])

  const navClass = (active: boolean) =>
    `rounded-control px-3.5 py-2 text-sm font-medium transition-colors ${active ? 'bg-brand-tint font-semibold text-brand' : 'text-ink hover:bg-paper'}`

  return <header className="sticky top-0 z-40 border-b border-rule bg-sheet/95 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
      <Link href={home} aria-label={siteMetadata.headerTitle} className="flex min-w-0 items-center gap-3 text-ink">
        <img src={siteMetadata.siteLogo} alt="" className="h-9 w-9 shrink-0" />
        <span className="min-w-0 leading-tight">
          <span className="ys-title block truncate text-lg">{siteMetadata.headerTitle}</span>
          <span className="hidden text-xs text-ink-soft sm:block">团队声音工作台</span>
        </span>
      </Link>
      <nav aria-label="主导航" className="flex shrink-0 items-center gap-1">
        <Link href={home} aria-current={pathname === home ? 'page' : undefined} className={`hidden sm:inline-block ${navClass(pathname === home)}`}>工作台</Link>
        <Link href={settings} aria-current={pathname === settings ? 'page' : undefined} className={navClass(pathname === settings)}>设置</Link>
        <ThemeSwitch />
        {displayName && <span aria-label={`当前成员 ${displayName}`} title={displayName}
          className="ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-voice-tint text-sm font-bold text-voice-deep">
          {displayName.slice(0, 1)}
        </span>}
      </nav>
    </div>
  </header>
}
