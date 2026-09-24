import { getDb } from "@/db/db";
import { tasksTable } from "@/db/schema";
import { NewTask, Task } from "@/db/types";
import { eq } from "drizzle-orm";
import { queryWrap } from "@/utils/db-util";
import moment from "moment";
import { TaskStatus } from "@/types/task";


export function getTaskLogKey(task: NewTask) {
    return `task_id=${task.id}, user_email=${task.userEmail}`
}

export function getTaskStatusHuman(status: TaskStatus) {
    const labels: Record<TaskStatus, string> = {
        [TaskStatus.Pending]: '等待中',
        [TaskStatus.Processing]: '生成中',
        [TaskStatus.Success]: '已完成',
        [TaskStatus.Failed]: '失败',
    }
    return labels[status] || status;
}
