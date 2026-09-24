import type { Task } from '@/db/types'

type Viewer = { userEmail: string; isAdmin: boolean; isTeamMember: boolean }

export function canReadTask(task: Pick<Task, 'userEmail' | 'visibility'>, viewer: Viewer): boolean {
  return Boolean(viewer.userEmail) &&
    (viewer.isAdmin || task.userEmail === viewer.userEmail || (viewer.isTeamMember && task.visibility === 'team'))
}

export function canManageTask(task: Pick<Task, 'userEmail'>, viewer: Viewer): boolean {
  return Boolean(viewer.userEmail) && (viewer.isAdmin || task.userEmail === viewer.userEmail)
}
