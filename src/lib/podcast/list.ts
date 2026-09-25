import 'server-only'
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { sessionsTable, tasksTable } from '@/db/schema'
import { TaskVO } from '@/lib/client-api/types/TaskVO'
import { TaskStatus } from '@/types/task'
import { getTaskStatusHuman } from '@/utils/task'
import { taskScopeWhere } from './scope'

export type EpisodeListViewer = {
  userId: number
  userEmail: string
  isAdmin: boolean
  isTeamMember: boolean
}

export type EpisodeListData = {
  items: TaskVO[]
  viewer: { userId: number; isAdmin: boolean; isTeamMember: boolean; scope: string }
  pagination: { total: number; page: number; pageSize: number; totalPages: number }
}

export async function loadEpisodeList(viewer: EpisodeListViewer, options: {
  page: number; pageSize: number; status: string; search: string; folder: string; scope: string
}): Promise<EpisodeListData> {
  const { page, pageSize, status, search, folder } = options
  const scope = options.scope || (viewer.isAdmin ? 'all' : viewer.isTeamMember ? 'team' : 'mine')
  const conditions = [taskScopeWhere(viewer, scope)]
  if (status && status !== 'all') conditions.push(eq(tasksTable.status, status))
  if (folder) conditions.push(sql`left(${tasksTable.folderPath}, ${folder.length}) = ${folder}`)
  if (search) conditions.push(or(ilike(tasksTable.uuid, `%${search}%`),
    sql`${tasksTable.userInputs}::text ILIKE ${`%${search}%`}`,
    sql`${tasksTable.stepsDetail}::text ILIKE ${`%${search}%`}`))
  const where = and(...conditions)
  const tasks = await getDb().select({
    totalCount: sql<number>`count(*) over ()`.mapWith(Number),
    uuid: tasksTable.uuid, userId: tasksTable.userId, userEmail: tasksTable.userEmail,
    status: tasksTable.status, statusReason: tasksTable.statusReason,
    folderPath: tasksTable.folderPath, labels: tasksTable.labels, visibility: tasksTable.visibility,
    createdAt: tasksTable.createdAt, updatedAt: tasksTable.updatedAt,
    ownerName: sessionsTable.displayName,
    fileName: sql<string | null>`${tasksTable.userInputs}::jsonb ->> 'fileName'`,
    inputPreview: sql<string | null>`left(${tasksTable.userInputs}::jsonb ->> 'text', 48)`,
    title: sql<string | null>`${tasksTable.stepsDetail}::jsonb #>> '{audio,input,title}'`,
    audioLocation: sql<string | null>`${tasksTable.stepsDetail}::jsonb #>> '{audio,output,location}'`,
    duration: sql<number | null>`(${tasksTable.stepsDetail}::jsonb #>> '{audio,output,duration}')::double precision`,
    progress: sql<TaskVO['progress']>`${tasksTable.result}::jsonb -> 'progress'`,
  }).from(tasksTable).leftJoin(sessionsTable, eq(tasksTable.userId, sessionsTable.id))
    .where(where).orderBy(desc(tasksTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize)
  const total = tasks.length ? tasks[0].totalCount :
    (await getDb().select({ count: count() }).from(tasksTable).where(where))[0].count

  const items: TaskVO[] = tasks.map(task => {
    const reason = task.statusReason as { detail?: string; msg?: string } | null
    return {
      uuid: task.uuid,
      user_id: task.userId,
      user_email: task.userEmail,
      owner_name: task.ownerName || (task.userEmail === 'admin@twocast.invalid' ? '管理员' : `用户 #${task.userId}`),
      folder_path: task.folderPath,
      labels: task.labels,
      visibility: task.visibility,
      error: task.status === TaskStatus.Failed ? reason?.detail || reason?.msg || null : null,
      status: task.status as TaskStatus,
      status_human: getTaskStatusHuman(task.status as TaskStatus),
      user_inputs: { fileName: task.fileName, text: task.inputPreview },
      result: { title: task.title,
        audio_url: task.audioLocation ? `/api/protected/tasks/${encodeURIComponent(task.uuid)}/audio` : undefined,
        duration: task.duration },
      progress: task.progress || null,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    }
  })

  return { items, viewer: { userId: viewer.userId, isAdmin: viewer.isAdmin, isTeamMember: viewer.isTeamMember, scope },
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } }
}
