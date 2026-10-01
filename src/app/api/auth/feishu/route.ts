import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/user'
export async function GET(req: NextRequest) {
  const appId = process.env.FEISHU_APP_ID,
    origin = process.env.APP_PUBLIC_ORIGIN
  const enabled = Boolean(appId && process.env.FEISHU_APP_SECRET && origin)
  if (req.nextUrl.searchParams.has('status')) return NextResponse.json({ enabled })
  if (!enabled)
    return NextResponse.json({ error: '飞书登录尚未配置，请使用个人登录码' }, { status: 503 })
  const mode = req.nextUrl.searchParams.get('mode') === 'bind' ? 'bind' : 'login'
  const user = await getCurrentUser()
  if (mode === 'bind' && !user.userId)
    return NextResponse.json({ error: '先使用邀请码或个人码登录，再绑定飞书' }, { status: 401 })
  const state = randomBytes(32).toString('hex')
  const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize')
  url.searchParams.set('app_id', appId!)
  url.searchParams.set('redirect_uri', `${origin}/api/auth/feishu/callback`)
  url.searchParams.set('state', state)
  const response = NextResponse.redirect(url)
  response.cookies.set(
    'feishu_oauth',
    JSON.stringify({ state, mode, userId: mode === 'bind' ? user.userId : null }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/feishu',
      maxAge: 600,
    }
  )
  return response
}
