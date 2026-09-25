'use client'

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

  return <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/85">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Link href={home} aria-label={siteMetadata.headerTitle} className="flex min-w-0 items-center gap-3">
        <img src={siteMetadata.siteLogo} alt="" className="h-10 w-10 shrink-0 rounded-xl shadow-sm" />
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold tracking-tight text-slate-950 dark:text-white">{siteMetadata.headerTitle}</span>
          <span className="hidden text-xs tracking-wide text-slate-500 dark:text-slate-400 sm:block">团队声音工作台</span>
        </span>
      </Link>
      <nav aria-label="主导航" className="flex shrink-0 items-center gap-3 text-sm sm:gap-5">
        <Link href={home} aria-current={pathname === home ? 'page' : undefined}
          className="hidden font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-200 sm:block">工作台</Link>
        <Link href={settings} aria-current={pathname === settings ? 'page' : undefined}
          className="font-medium text-slate-700 hover:text-indigo-600 dark:text-slate-200">设置</Link>
        <ThemeSwitch />
      </nav>
    </div>
  </header>
}
