

import { cookies } from 'next/headers'
import { and, eq, gt } from 'drizzle-orm'
import { createHash } from 'crypto'
import { getDb } from '@/db/db'
import { sessionsTable } from '@/db/schema'

export const SESSION_COOKIE = 'twocast_session'

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function getCurrentUser() {
  // Local development remains usable without an invite database.
  if (process.env.NODE_ENV !== 'production' && process.env.INVITE_REQUIRED !== '1') {
    return { userId: 0, userEmail: 'local@twocast.invalid', isAdmin: true, inviteCodeId: null, displayName: '本地管理员' }
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return { userId: 0, userEmail: '', isAdmin: false, inviteCodeId: null, displayName: '' }
  }

  const sessions = await getDb().select().from(sessionsTable).where(and(
    eq(sessionsTable.tokenHash, sha256(token)),
    gt(sessionsTable.expiresAt, new Date()),
  )).limit(1)
  const session = sessions[0]
  if (!session) return { userId: 0, userEmail: '', isAdmin: false, inviteCodeId: null, displayName: '' }
  const isAdmin = session.role === 'admin'
  return {
    userId: session.id,
    userEmail: isAdmin ? 'admin@twocast.invalid' : `invite-${session.id}@twocast.invalid`,
    isAdmin,
    inviteCodeId: session.inviteCodeId,
    displayName: session.displayName || (isAdmin ? '管理员' : `用户 #${session.id}`),
  }
}
