import type { Task } from '@/db/types'

type Viewer = {
  userId?: number
  userEmail: string
  isAdmin: boolean
  isTeamMember: boolean
  teamIds?: number[]
  teamAdminIds?: number[]
}

export function canReadTask(
  task: Pick<Task, 'userEmail' | 'visibility'> & {
    userId?: number
    sharedTeamIds?: number[]
    deletedAt?: Date | null
  },
  viewer: Viewer
): boolean {
  return (
    !task.deletedAt &&
    Boolean(viewer.userEmail) &&
    (viewer.isAdmin ||
      (task.userId !== undefined && viewer.userId !== undefined
        ? task.userId === viewer.userId
        : task.userEmail === viewer.userEmail) ||
      task.visibility === 'public' ||
      (task.visibility === 'team' &&
        (task.sharedTeamIds || []).some((id) => viewer.teamIds?.includes(id))))
  )
}

export function canManageTask(
  task: Pick<Task, 'userEmail'> & {
    userId?: number
    sharedTeamIds?: number[]
    deletedAt?: Date | null
  },
  viewer: Viewer
): boolean {
  return (
    !task.deletedAt &&
    Boolean(viewer.userEmail) &&
    (viewer.isAdmin ||
      (task.userId !== undefined && viewer.userId !== undefined
        ? task.userId === viewer.userId
        : task.userEmail === viewer.userEmail))
  )
}
