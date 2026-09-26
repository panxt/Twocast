'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import siteMetadata from '@/data/siteMetadata'
import Link from './mdxcomponents/Link'
import ThemeSwitch from './theme/ThemeSwitch'
import type { LocaleTypes } from '@/i18n/settings'
import { getLocalePath } from '@/utils/locale-util'

// 顶栏：手机 / 平板用；桌面端由左侧栏承担导航，这里只在进入页保留品牌。
export default function Header() {
  const locale = useParams()?.locale as LocaleTypes
  const pathname = usePathname()
  const home = getLocalePath(locale, '/')
  const settings = getLocalePath(locale, '/settings')
  const onEnterCode = pathname.endsWith('/enter-code')
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/auth/me', { cache: 'no-store' }).then(response => response.json())
      .then(me => { if (alive) setAuthenticated(Boolean(me.authenticated)) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [pathname])

  const navClass = (active: boolean) =>
    `rounded-control px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-brand-tint font-semibold text-brand' : 'text-ink hover:bg-paper'}`

  return <header className={`sticky top-0 z-40 border-b border-rule bg-sheet/95 backdrop-blur ${onEnterCode || !authenticated ? '' : 'lg:hidden'}`}>
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
      <Link href={home} aria-label={siteMetadata.headerTitle} className="flex min-w-0 items-center gap-3 text-ink">
        <img src={siteMetadata.siteLogo} alt="" className="h-9 w-9 shrink-0" />
        <span className="min-w-0 leading-tight">
          <span className="ys-title block truncate text-lg">{siteMetadata.headerTitle}</span>
          <span className="hidden text-xs text-ink-soft sm:block">团队声音工作台</span>
        </span>
      </Link>
      <nav aria-label="主导航" className="flex shrink-0 items-center gap-1">
        {authenticated && !onEnterCode && <>
          <Link href={`${home}?new=1`} className="ys-btn-sm ys-btn-primary"><Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />新建</Link>
          <Link href={settings} aria-current={pathname === settings ? 'page' : undefined} className={navClass(pathname === settings)}>设置</Link>
        </>}
        <ThemeSwitch />
      </nav>
    </div>
  </header>
}
