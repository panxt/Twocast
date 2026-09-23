'use client'

import { useParams, usePathname } from 'next/navigation'
import siteMetadata from '@/data/siteMetadata'
import headerNavLinks from '@/data/headerNavLinks'
import Link from './mdxcomponents/Link'
import ThemeSwitch from './theme/ThemeSwitch'
import LangSwitch from './langswitch'
import { useTranslation } from '@/i18n/client'
import type { LocaleTypes } from '@/i18n/settings'
import { getLocalePath } from '@/utils/locale-util'

export default function Header() {
  const locale = useParams()?.locale as LocaleTypes
  const { t } = useTranslation(locale, 'home')
  const pathname = usePathname()

  return (
    <header>
      <div className="flex items-center justify-between py-10 px-4">
        <div>
          <Link href={getLocalePath(locale, '/')} aria-label={siteMetadata.headerTitle}>
            <div className="flex items-center justify-between">
              {siteMetadata.siteLogo && <div className="mr-3">
                <img src={siteMetadata.siteLogo} alt="logo" className="w-10 h-10 rounded-full" />
              </div>}
              {typeof siteMetadata.headerTitle === 'string' ? (
                <div className="h-6 text-2xl font-semibold sm:block dark:text-white">
                  {siteMetadata.headerTitle}
                </div>
              ) : (
                siteMetadata.headerTitle
              )}
            </div>
          </Link>
        </div>
        <div className="flex items-center space-x-4 rtl:space-x-reverse leading-5 sm:space-x-6">
          {headerNavLinks
            .filter((link) => {
              return link.href !== '/'
            })
            .map((link) => {
              const isSelected = pathname!.includes(link.href as string)
              return (
                <Link
                  key={link.title}
                  href={getLocalePath(locale, `${link.href}`)}
                  className={`hidden font-medium ${
                    isSelected ? 'text-primary-500' : 'text-gray-900 dark:text-gray-100'
                  }  sm:block`}
                >
                  {t(`header.${link.title.toLowerCase()}`)}
                </Link>
              )
            })}
          <ThemeSwitch />
          <LangSwitch />
          <Link href={getLocalePath(locale, '/settings')} className="text-sm text-gray-700 dark:text-gray-200">设置</Link>
        </div>
      </div>
    </header>
  )
}
