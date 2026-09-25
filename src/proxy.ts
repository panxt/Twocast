import { NextRequest, NextResponse } from 'next/server'
import { locales } from '@/i18n/settings'
import { fallbackLng } from '@/i18n/locales'

export const config = {
  matcher: '/((?!_next|static|assets|favicon.ico|robots.txt|sitemap.xml).*)',
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const inviteEnabled = process.env.NODE_ENV === 'production' || process.env.INVITE_REQUIRED === '1'
  const isEnterCode = pathname === '/enter-code' || locales.some(locale => pathname === `/${locale}/enter-code`)
  // Workflow callbacks authenticate themselves and do not carry a browser session.
  const isWorkflowCallback = pathname.startsWith('/.well-known/workflow/')

  // The private workspace currently has only Chinese product copy. Keep old
  // language bookmarks working without presenting an untranslated UI.
  const legacyLocale = locales.find(locale => locale !== fallbackLng &&
    (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)))
  if (legacyLocale) {
    const rest = pathname.slice(legacyLocale.length + 1) || '/'
    return NextResponse.redirect(new URL(`${rest}${search}`, request.url))
  }

  if (pathname === '/enter-code') {
    return NextResponse.redirect(new URL(`/${fallbackLng}/enter-code${search}`, request.url))
  }
  if (inviteEnabled && !isEnterCode && !isWorkflowCallback && !pathname.startsWith('/api/auth/') &&
    !request.cookies.get('twocast_session')?.value) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.redirect(new URL(`/${fallbackLng}/enter-code`, request.url))
  }

  if (pathname.startsWith('/api/') || isEnterCode || isWorkflowCallback) return NextResponse.next()
  if (pathname === `/${fallbackLng}` || pathname.startsWith(`/${fallbackLng}/`)) {
    const stripped = pathname.slice(fallbackLng.length + 1) || '/'
    return NextResponse.redirect(new URL(`${stripped}${search}`, request.url))
  }
  if (locales.every(locale => pathname !== `/${locale}` && !pathname.startsWith(`/${locale}/`))) {
    return NextResponse.rewrite(new URL(`/${fallbackLng}${pathname}${search}`, request.url))
  }
  return NextResponse.next()
}
