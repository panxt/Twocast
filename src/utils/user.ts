import { cookies } from 'next/headers'
import { and, eq, gt, sql, getTableColumns } from 'drizzle-orm'
import { createHash } from 'crypto'
import { getDb } from '@/db/db'
import { sessionsTable, deviceSessionsTable, teamMembersTable, teamsTable } from '@/db/schema'

export const SESSION_COOKIE = 'twocast_session'

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function getCurrentUser() {
  // Local development remains usable without an invite database.
  if (process.env.NODE_ENV !== 'production' && process.env.INVITE_REQUIRED !== '1') {
    return {
      userId: 0,
      userEmail: 'local@twocast.invalid',
      isAdmin: true,
      isSuperAdmin: true,
      isTeamMember: true,
      teamIds: [] as number[],
      teamAdminIds: [] as number[],
      inviteCodeId: null,
      displayName: '本地管理员',
    }
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return {
      userId: 0,
      userEmail: '',
      isAdmin: false,
      isSuperAdmin: false,
      isTeamMember: false,
      teamIds: [] as number[],
      teamAdminIds: [] as number[],
      inviteCodeId: null,
      displayName: '',
    }
  }

  const db = getDb()
  const [session] = await db
    .select({
      ...getTableColumns(sessionsTable),
      teamIds: sql<
        number[]
      >`coalesce(array_agg(${teamMembersTable.teamId}) filter(where ${teamsTable.active}=true),ARRAY[]::integer[])`,
      teamAdminIds: sql<
        number[]
      >`coalesce(array_agg(${teamMembersTable.teamId}) filter(where ${teamsTable.active}=true and ${teamMembersTable.role}='admin'),ARRAY[]::integer[])`,
    })
    .from(deviceSessionsTable)
    .innerJoin(sessionsTable, eq(sessionsTable.id, deviceSessionsTable.userId))
    .leftJoin(teamMembersTable, eq(teamMembersTable.userId, sessionsTable.id))
    .leftJoin(teamsTable, eq(teamsTable.id, teamMembersTable.teamId))
    .where(
      and(
        eq(deviceSessionsTable.tokenHash, sha256(token)),
        gt(deviceSessionsTable.expiresAt, new Date()),
        gt(sessionsTable.expiresAt, new Date()),
        eq(sessionsTable.disabled, false)
      )
    )
    .groupBy(sessionsTable.id)
    .limit(1)
  if (!session)
    return {
      userId: 0,
      userEmail: '',
      isAdmin: false,
      isSuperAdmin: false,
      isTeamMember: false,
      teamIds: [] as number[],
      teamAdminIds: [] as number[],
      inviteCodeId: null,
      displayName: '',
    }
  const isSuperAdmin = session.role === 'super_admin'
  const isAdmin = isSuperAdmin || session.role === 'admin'
  return {
    userId: session.id,
    userEmail: isAdmin ? 'admin@twocast.invalid' : `invite-${session.id}@twocast.invalid`,
    isAdmin,
    isSuperAdmin,
    isTeamMember: isAdmin || session.teamIds.length > 0,
    teamIds: session.teamIds,
    teamAdminIds: session.teamAdminIds,
    inviteCodeId: session.inviteCodeId,
    displayName: session.displayName || (isAdmin ? '管理员' : `用户 #${session.id}`),
  }
}
