import { and, eq, or, sql, isNull, type SQL } from 'drizzle-orm'
import { tasksTable } from '@/db/schema'

type Viewer = {
  userId?: number
  userEmail: string
  isAdmin: boolean
  isTeamMember: boolean
  teamIds?: number[]
}

export function taskScopeWhere(viewer: Viewer, scope: string): SQL | undefined {
  if (!viewer.userEmail) return sql`false`
  const visible = isNull(tasksTable.deletedAt)
  if (scope === 'public') return and(visible, eq(tasksTable.visibility, 'public'))
  if (viewer.isAdmin && scope === 'all') return visible
  const owner =
    viewer.userId !== undefined
      ? eq(tasksTable.userId, viewer.userId)
      : eq(tasksTable.userEmail, viewer.userEmail)
  if (viewer.isTeamMember && scope === 'team')
    return and(
      visible,
      or(
        owner,
        and(
          eq(tasksTable.visibility, 'team'),
          or(
            ...(viewer.teamIds || []).map(
              (id) => sql`${tasksTable.sharedTeamIds}::jsonb @> ${JSON.stringify([id])}::jsonb`
            )
          ) || sql`false`
        )
      )
    )
  return and(visible, owner)
}
