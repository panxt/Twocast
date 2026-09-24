import { respData, respErr } from "@/utils/resp";
import { getDb } from '@/db/db';
import { tasksTable, sessionsTable } from '@/db/schema';
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { TaskStatus } from "@/types/task";
import { NextRequest } from "next/server";
import { TaskVO } from "@/lib/client-api/types/TaskVO";
import { getCurrentUser } from "@/utils/user";
import { getTaskStatusHuman } from "@/utils/task";
import { taskScopeWhere } from '@/lib/podcast/scope';

export async function GET(req: NextRequest) {
    const { userId, userEmail, isAdmin, isTeamMember } = await getCurrentUser()
    if (!userEmail) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    // Get pagination parameters from URL
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('page_size') || 10) || 10));
    const status = searchParams.get('status') || '';
    const search = (searchParams.get('search') || '').trim().slice(0, 80);
    const folder = (searchParams.get('folder') || '').slice(0, 255);
    const scope = searchParams.get('scope') || (isAdmin ? 'all' : isTeamMember ? 'team' : 'mine');
    const conditions = [taskScopeWhere({ userEmail, isAdmin, isTeamMember }, scope)];
    if (status && status !== 'all') conditions.push(eq(tasksTable.status, status));
    if (folder) {
      if (!folder.startsWith('/') || !folder.endsWith('/')) return respErr('目录格式无效');
      conditions.push(sql`left(${tasksTable.folderPath}, ${folder.length}) = ${folder}`);
    }
    if (search) conditions.push(or(ilike(tasksTable.uuid, `%${search}%`),
      sql`${tasksTable.userInputs}::text ILIKE ${`%${search}%`}`,
      sql`${tasksTable.stepsDetail}::text ILIKE ${`%${search}%`}`));
    const where = and(...conditions);
    const [{ count: total }] = await getDb().select({ count: count() }).from(tasksTable).where(where);
    const tasks = await getDb().select({
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
    })
      .from(tasksTable).leftJoin(sessionsTable, eq(tasksTable.userId, sessionsTable.id))
      .where(where).orderBy(desc(tasksTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
    
    const tasksVO: TaskVO[] = tasks.map(task => {
        let error: string | null = null
        if (task.status === TaskStatus.Failed) {
            const reason = task.statusReason as { detail?: string; msg?: string } | null
            if (reason?.detail) {
                error = reason.detail
            } else {
                error = reason?.msg || null
            }
        }
        return {
            uuid: task.uuid,
            user_id: task.userId,
            user_email: task.userEmail,
            owner_name: task.ownerName || (task.userEmail === 'admin@twocast.invalid' ? '管理员' : `用户 #${task.userId}`),
            folder_path: task.folderPath,
            labels: task.labels,
            visibility: task.visibility,
            error,
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
    });

    return respData({
        items: tasksVO,
        pagination: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        }
    });
}
