import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'
import { SESSION_COOKIE, sha256 } from '@/utils/user'

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  // This row also owns the account, login code and API settings. Revoke the
  // browser token without deleting the identity or pausing its shared API.
  if (token) await getDb().update(sessionsTable)
    .set({ tokenHash: sha256(randomBytes(32).toString('hex')) })
    .where(eq(sessionsTable.tokenHash, sha256(token)))
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
