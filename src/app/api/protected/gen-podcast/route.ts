import { respData, respErr, respErrCode } from "@/utils/resp";

import { getDb } from "@/db/db";
import { tasksTable } from "@/db/schema";
import { NewTask } from "@/db/types";
import { taskSetStepItem } from "@/lib/podcast/task";
import { PodcastInputType, PodcastStep } from "@/lib/podcast/types";
import { genTaskId } from '@/models/task';
import { getLinkQueue } from "@/queue/link_queue";
import { getLongTextQueue } from "@/queue/long_text_queue";
import { getTopicQueue } from "@/queue/topic_queue";
import { TaskStatus } from "@/types/task";
import { queryWrap } from "@/utils/db-util";
import { getCurrentUser } from "@/utils/user";
import axios from "axios";
import { Buffer } from "buffer";
import { getFrontPageQueue } from "@/queue/front_page_queue";
import { and, count, eq, gte, inArray } from 'drizzle-orm';
import { start } from 'workflow/api';
import { generatePodcastWorkflow } from '@/lib/podcast/workflow';

export async function POST(req: Request) {
  const { userId, userEmail } = await getCurrentUser()
  if (!userEmail) {
    return new Response(JSON.stringify({ error: '邀请码验证后才能生成播客' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const [usage] = await getDb().select({ count: count() }).from(tasksTable)
    .where(and(eq(tasksTable.userEmail, userEmail), gte(tasksTable.createdAt, today)))
  if (usage.count >= (process.env.NODE_ENV === 'production' ? 3 : 100)) {
    return new Response(JSON.stringify({ error: '今日生成次数已用完' }), { status: 429 })
  }
  const [pending] = await getDb().select({ count: count() }).from(tasksTable)
    .where(and(eq(tasksTable.userEmail, userEmail), inArray(tasksTable.status, [TaskStatus.Pending, TaskStatus.Processing])))
  if (pending.count >= 1) {
    return new Response(JSON.stringify({ error: '请等待上一条播客完成' }), { status: 429 })
  }

  const formData = await req.formData()
  const type = formData.get('type')
  let text = formData.get('text')
  const platform = formData.get('platform')
  const voice_id_1 = formData.get('voice_id_1')
  const voice_id_2 = formData.get('voice_id_2')
  const file = formData.get('file')
  const language = formData.get('language')
  if (type === PodcastInputType.File && file) {
    if (process.env.NODE_ENV === 'production') return new Response(JSON.stringify({ error: '文件上传暂未开放' }), { status: 400 })
    text = await extractTextFromTextract(file as unknown as File)
    text = text.replace(/\n[\n]+/g, '\n').trim()
  } else if (text && typeof text === 'string') {
    text = text.trim()
    if (text.length > 100_000) {
      return respErr("invalid params: text is too long");
    }
  }
  if (!text) {
    return respErr("invalid params: text is empty");
  }

  // check credits
  if (process.env.NEXT_PUBLIC_CLERK_ENABLED) {
  }

  // check if there is a pending task
  if (process.env.NEXT_PUBLIC_CLERK_ENABLED) {
  }

  const task: NewTask = {
    userId: userId,
    uuid: genTaskId(),
    userEmail: userEmail,
    userInputs: {
      type: type as PodcastInputType,
      text: text as string,
      platform: platform,
      voice_id_1: voice_id_1,
      voice_id_2: voice_id_2,
      language: language as string,
      // file: resp?.Location || ""
    },
    status: TaskStatus.Pending,
    consumedCredits: 0,
    createdAt: new Date(),
  }

  // 设置队列参数
  switch (type) {
    case PodcastInputType.Topic:
      taskSetStepItem(task, PodcastStep.Topic, {
        input: text,
      })
      break
    case PodcastInputType.Link:
      taskSetStepItem(task, PodcastStep.Link, {
        input: text,
      })
      break
    case PodcastInputType.File:
    case PodcastInputType.LongText:
      taskSetStepItem(task, PodcastStep.LongText, {
        input: text,
      })
      break
    case PodcastInputType.FrontPage:
      taskSetStepItem(task, PodcastStep.FrontPage, {
        input: text,
      })
      break
  }


  // save to db
  task.id = (await queryWrap(getDb().insert(tasksTable).values(task).returning({ id: tasksTable.id })))[0].id!

  if (process.env.VERCEL === '1') {
    try {
      await start(generatePodcastWorkflow, [task.uuid])
    } catch (error) {
      await getDb().update(tasksTable).set({ status: TaskStatus.Failed,
        statusReason: { msg: '后台任务启动失败' } }).where(eq(tasksTable.id, task.id))
      throw error
    }
    return respData(task)
  }

  // 传给队列
  switch (type) {
    case PodcastInputType.Topic:
      getTopicQueue().add('topic', { task: task })
      break
    case PodcastInputType.Link:
      getLinkQueue().add('link', { task: task })
      break
    case PodcastInputType.File:
    case PodcastInputType.LongText:
      getLongTextQueue().add('long_text', { task: task })
      break
    case PodcastInputType.FrontPage:
      getFrontPageQueue().add('front_page', { task: task })
      break
  }

  return respData(task);
}

async function extractTextFromTextract(file: File): Promise<string> {
  // 1. 获取文件名和类型
  const name = file.name || '';
  const ext = name.split('.').pop()?.toLowerCase();
  // 2. 读取文件内容为 Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  // 3. 转为 base64
  const base64String = buffer.toString('base64');

  // 4. 构造请求体
  const data = {
    data: base64String,
    file_type: ext,
  };

  // 5. 发送 POST 请求
  try {
    const resp = await axios.post(process.env.SERVICE_TEXTRACT_API!, data, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60s 超时
    });
    if (resp.data && typeof resp.data.text === 'string') {
      return resp.data.text;
    } else {
      throw new Error('Textract API 响应无效');
    }
  } catch (err: any) {
    throw new Error('Textract API 调用失败: ' + (err?.message || err));
  }
}
