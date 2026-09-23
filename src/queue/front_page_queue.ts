import { PodcastStep } from "@/lib/podcast/types";
import { BaseJobData } from "./types";

import { getDb } from "@/db/db";
import { tasksTable } from "@/db/schema";
import { Task } from "@/db/types";
import { taskGetStepItem, taskUpdateStepItem } from "@/lib/podcast/task";
import { queryWrap } from "@/utils/db-util";
import { getTaskLogKey } from "@/utils/task";
import { ArticleData, analyseArticleFromUrl, extractHotLinksFromUrl } from "@/lib/podcast/utils";
import { Queue } from 'bullmq';
import { eq } from "drizzle-orm";
import { getLongTextQueue } from "./long_text_queue";
import { addJob, initQueue } from "./queue_base";
import { getRedis } from "@/utils/redis";

const QueueName = 'front_page_queue'
const currentStep = PodcastStep.FrontPage
let queue: Queue<BaseJobData>;

export function getFrontPageQueue(): Queue<BaseJobData> {
  if (queue) {
    return queue
  }

  queue = new Queue<BaseJobData>(QueueName, {connection: getRedis()})

  return queue
}

export function setupFrontPageQueue() {
  const queue = getFrontPageQueue();
  initQueue({
    queue: queue,
    processTask: processFrontPageTask,
    currentStep: currentStep,
    queueName: QueueName
  })
}

export async function processFrontPageTask(task: Task, enqueueNext = true) {
  const stepItem = taskGetStepItem(task, PodcastStep.FrontPage)
  let text = '', links: { title: string, url: string }[] = []
  console.log(`[${currentStep}:processTask] extract text, key=${getTaskLogKey(task)}`)
  if (process.env.MOCK_ENABLED) {
    text = 'xxx'
  } else {
    // 提取热文链接
    console.log('extractHotLinksFromUrl', stepItem.input)
    links = await extractHotLinksFromUrl(stepItem.input!.trim())
    // console.log('links', JSON.stringify(links))
    links = links.slice(0, 10) // 只取前 10 个
    // 遍历链接，获得文章
    const articles: ArticleData[] = []
    const promises: Promise<ArticleData>[] = []
    for (const link of links) {
      promises.push(analyseArticleFromUrl(link.url))
    }
    const results = await Promise.all(promises)
    for (const result of results) {
      articles.push(result)
    }
    text = JSON.stringify(articles)
  }

  taskUpdateStepItem(task, PodcastStep.FrontPage, {
    output: {
      links: links,
    }
  })

  taskUpdateStepItem(task, PodcastStep.LongText, {
    input: text,
  })

  // save to db
  await queryWrap(getDb().update(tasksTable).set({
    stepsDetail: task.stepsDetail,
  }).where(eq(tasksTable.id, task.id)))

  // 传给下个队列
  if (enqueueNext) await addJob(getLongTextQueue(), { task: task })
}
