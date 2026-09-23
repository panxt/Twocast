import { PodcastStep } from "@/lib/podcast/types";
import { BaseJobData } from "./types";

// import Queue, { Job } from "bee-queue";
import { getDb } from "@/db/db";
import { tasksTable } from "@/db/schema";
import { Task } from "@/db/types";
import { taskGetStepItem, taskSetStepItem, taskUpdateStepItem } from "@/lib/podcast/task";
import { queryWrap } from "@/utils/db-util";
import { getTaskLogKey } from "@/utils/task";
import { querySearch } from "@/utils/xai";
import { Queue } from 'bullmq';
import { eq } from "drizzle-orm";
import { ChatCompletion } from "openai/resources/index";
import { getLongTextQueue } from "./long_text_queue";
import { initQueue } from "./queue_base";
import { getRedis } from "@/utils/redis";

const QueueName = 'topic_queue'
const currentStep = PodcastStep.Topic
let queue: Queue<BaseJobData>;

export function getTopicQueue(): Queue<BaseJobData> {
  if (queue) {
    return queue
  }

  queue = new Queue<BaseJobData>(QueueName, {connection: getRedis()})

  return queue
}

export function setupTopicQueue() {
  const queue = getTopicQueue();
  initQueue({
    queue: queue,
    processTask: processTopicTask,
    currentStep: currentStep,
    queueName: QueueName
  })
}

export async function processTopicTask(task: Task, enqueueNext = true) {
  const stepItem = taskGetStepItem(task, PodcastStep.Topic)
  console.log(`[${currentStep}:processTask] query topic, key=${getTaskLogKey(task)}`)
  let text = ''
  if (process.env.MOCK_ENABLED) {
    text = `关键要点
过去一年（2024年5月22日至2025年5月22日），一些个人和公司通过创建工具类、SaaS类或AI类网站在X上赚取了收入或获得了流量增长。
研究表明，@AlexFinnX、@damengchen、@levelsio、@yasser_elsaid_、GrowthXAI、@johnrushx、David（Jenni AI）和@alex_leiman等在X上取得了显著的财务或流量成果。
证据倾向于支持这些成就，但部分数据基于个人X帖子，可能存在自报偏差。
直接回答
以下是过去一年内在X上通过制作工具类、SaaS类或AI类网站赚到钱或流量增长的个人和公司：

个人成就
@AlexFinnX 创建了Creator Buddy，年收入达到30万美元。
@damengchen 通过ChatGPT包装器每月赚取7万美元。
@levelsio 通过Flux包装器每月赚取10万美元。
@yasser_elsaid_ 通过OpenAI包装器每月赚取39万美元。
@johnrushx 推出了多个AI工具，如Seobot和Listingbott，显示出活跃的市场表现。
David（由@MurataAlgoK提及）创建的Jenni AI应用月收入超过50万美元。
@alex_leiman 创建的Rizzgpt下载量超过500万，年收入超过1500万美元，并推出了$NOODLE，峰值市值达1900万美元。
公司成就
GrowthXAI 融资1200万美元的Series A轮，并在一年内实现年收入700万美元以上，服务客户包括Reddit、Webflow和Superhuman。
这些信息主要来自X帖子和相关网络验证，部分数据可能基于个人报告，建议进一步核实。`
  } else {
    const resp = await querySearch(stepItem.input!)
    const data = resp.data as ChatCompletion
    text = data.choices[0].message.content!
  }

  // set value
  taskUpdateStepItem(task, PodcastStep.Topic, {
    updated_at: new Date(),
  })
  taskSetStepItem(task, PodcastStep.LongText, {
    input: text,
  })
  if (process.env.NEXT_PUBLIC_CLERK_ENABLED) {
  }

  // save to db
  await queryWrap(getDb().update(tasksTable).set({
    stepsDetail: task.stepsDetail
  }).where(eq(tasksTable.id, task.id)))

  // 传给下个队列
  if (enqueueNext) await getLongTextQueue().add('long_text', { task: task })
}
