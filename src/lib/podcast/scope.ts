import { eq, or, type SQL } from 'drizzle-orm'
import { tasksTable } from '@/db/schema'

type Viewer = { userEmail: string; isAdmin: boolean; isTeamMember: boolean }

export function taskScopeWhere(viewer: Viewer, scope: string): SQL | undefined {
  if (viewer.isAdmin && scope === 'all') return undefined
  const owner = eq(tasksTable.userEmail, viewer.userEmail)
  if (viewer.isTeamMember && scope === 'team') return or(owner, eq(tasksTable.visibility, 'team'))
  return owner
}
