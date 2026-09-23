import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'
import { SESSION_COOKIE, sha256 } from '@/utils/user'

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token) await getDb().delete(sessionsTable).where(eq(sessionsTable.tokenHash, sha256(token)))
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
