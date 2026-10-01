import type { Task } from '@/db/types'

type Viewer = {
  userEmail: string
  isAdmin: boolean
  isTeamMember: boolean
  teamIds?: number[]
  teamAdminIds?: number[]
}

export function canReadTask(
  task: Pick<Task, 'userEmail' | 'visibility'> & {
    sharedTeamIds?: number[]
    deletedAt?: Date | null
  },
  viewer: Viewer
): boolean {
  return (
    !task.deletedAt &&
    Boolean(viewer.userEmail) &&
    (viewer.isAdmin ||
      task.userEmail === viewer.userEmail ||
      (task.visibility === 'team' &&
        (task.sharedTeamIds || []).some((id) => viewer.teamIds?.includes(id))))
  )
}

export function canManageTask(
  task: Pick<Task, 'userEmail'> & { sharedTeamIds?: number[]; deletedAt?: Date | null },
  viewer: Viewer
): boolean {
  return (
    !task.deletedAt &&
    Boolean(viewer.userEmail) &&
    (viewer.isAdmin || task.userEmail === viewer.userEmail)
  )
}
