import { PodcastStep } from "@/lib/podcast/types";
import { BaseJobData } from "./types";

import { getDb } from "@/db/db";
import { tasksTable } from "@/db/schema";
import { Task } from "@/db/types";
import { taskGetStepItem, taskUpdateStepItem } from "@/lib/podcast/task";
import { TaskStatus } from "@/types/task";
import { queryWrap } from "@/utils/db-util";
import { getTaskLogKey } from "@/utils/task";
// import Queue, { Job } from "bee-queue";
import { extractTextFromUrl } from "@/lib/podcast/utils";
import { Queue } from 'bullmq';
import { eq } from "drizzle-orm";
import { getLongTextQueue } from "./long_text_queue";
import { initQueue } from "./queue_base";
import { getRedis } from "@/utils/redis";

const QueueName = 'link_queue'
const currentStep = PodcastStep.Link
let queue: Queue<BaseJobData>;

export function getLinkQueue(): Queue<BaseJobData> {
  if (queue) {
    return queue
  }

  queue = new Queue<BaseJobData>(QueueName, {connection: getRedis()})

  return queue
}

export function setupLinkQueue() {
  const queue = getLinkQueue();
  initQueue({
    queue: queue,
    processTask: processLinkTask,
    currentStep: currentStep,
    queueName: QueueName
  })
}

export async function processLinkTask(task: Task, enqueueNext = true) {
  const stepItem = taskGetStepItem(task, PodcastStep.Link)
  let text = ''
  console.log(`[${currentStep}:processTask] extract text, key=${getTaskLogKey(task)}`)
  if (process.env.MOCK_ENABLED) {
    text = 'xxx'
  } else {
    text = await extractTextFromUrl(stepItem.input!.trim())
  }

  taskUpdateStepItem(task, PodcastStep.LongText, {
    input: text,
  })

  // save to db
  if (process.env.NEXT_PUBLIC_CLERK_ENABLED) {
  } else {
    await queryWrap(getDb().update(tasksTable).set({
      stepsDetail: task.stepsDetail,
      status: TaskStatus.Processing,
    }).where(eq(tasksTable.id, task.id)))
  }

  // 传给下个队列
  if (enqueueNext) await getLongTextQueue().add('long_text', { task: task })
}
