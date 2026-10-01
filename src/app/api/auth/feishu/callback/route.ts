import { randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { deviceSessionsTable, externalIdentitiesTable, sessionsTable } from '@/db/schema'
import { getCurrentUser, SESSION_COOKIE, sha256 } from '@/utils/user'
export async function GET(req: NextRequest) {
  const origin = process.env.APP_PUBLIC_ORIGIN
  if (!origin || !process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET)
    return NextResponse.json({ error: '飞书登录尚未配置' }, { status: 503 })
  let state: { state: string; mode: string; userId: number | null } | null = null
  try {
    state = JSON.parse(req.cookies.get('feishu_oauth')?.value || 'null')
  } catch {
    /* invalid state */
  }
  const finish = (path: string) => {
    const r = NextResponse.redirect(new URL(path, origin))
    r.cookies.delete('feishu_oauth')
    return r
  }
  if (
    !state ||
    state.state !== req.nextUrl.searchParams.get('state') ||
    !req.nextUrl.searchParams.get('code')
  )
    return finish('/zh/enter-code?error=feishu_state')
  try {
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.FEISHU_APP_ID,
        client_secret: process.env.FEISHU_APP_SECRET,
        code: req.nextUrl.searchParams.get('code'),
        redirect_uri: `${origin}/api/auth/feishu/callback`,
      }),
      signal: AbortSignal.timeout(15000),
    })
    const token = await tokenResponse.json()
    if (!tokenResponse.ok || !token.access_token) throw new Error('token')
    const infoResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
      headers: { authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    })
    const info = await infoResponse.json()
    if (!infoResponse.ok || info.code !== 0 || !info.data?.open_id || !info.data?.tenant_key)
      throw new Error('user_info')
    const subject = `${info.data.tenant_key}:${info.data.open_id}`
    const db = getDb()
    const [identity] = await db
      .select()
      .from(externalIdentitiesTable)
      .where(
        and(
          eq(externalIdentitiesTable.provider, 'feishu'),
          eq(externalIdentitiesTable.subject, subject)
        )
      )
    if (state.mode === 'bind') {
      const user = await getCurrentUser()
      if (
        !user.userId ||
        user.userId !== state.userId ||
        (identity && identity.userId !== user.userId)
      )
        return finish('/zh/settings?error=feishu_bind')
      await db
        .insert(externalIdentitiesTable)
        .values({ provider: 'feishu', subject, userId: user.userId })
        .onConflictDoNothing()
      return finish('/zh/settings?feishu=bound')
    }
    if (!identity) return finish('/zh/enter-code?error=feishu_unbound')
    const [account] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, identity.userId))
    // Administratively disabled accounts cannot return through SSO.
    if (!account || (!account.loginCodeHash && account.expiresAt <= new Date()))
      return finish('/zh/enter-code?error=feishu_disabled')
    const tokenValue = randomBytes(32).toString('hex'),
      expiresAt = new Date(Date.now() + 30 * 86400000)
    await db.transaction(async (tx) => {
      await tx.update(sessionsTable).set({ expiresAt }).where(eq(sessionsTable.id, account.id))
      await tx
        .insert(deviceSessionsTable)
        .values({ userId: account.id, tokenHash: sha256(tokenValue), expiresAt })
    })
    const response = finish('/zh/')
    response.cookies.set(SESSION_COOKIE, tokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 86400,
    })
    return response
  } catch {
    return finish('/zh/enter-code?error=feishu_failed')
  }
}
