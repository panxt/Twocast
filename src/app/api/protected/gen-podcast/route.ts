import { respData, respErr, respErrCode } from "@/utils/resp";

import { getDb } from "@/db/db";
import { tasksTable } from "@/db/schema";
import { NewTask } from "@/db/types";
import { taskSetStepItem } from "@/lib/podcast/task";
import { PodcastInputType, PodcastStep, Platform } from "@/lib/podcast/types";
import { genTaskId } from '@/models/task';
import { getLinkQueue } from "@/queue/link_queue";
import { getLongTextQueue } from "@/queue/long_text_queue";
import { getTopicQueue } from "@/queue/topic_queue";
import { TaskStatus } from "@/types/task";
import { queryWrap } from "@/utils/db-util";
import { getCurrentUser } from "@/utils/user";
import { Buffer } from "buffer";
import { extractText, getDocumentProxy } from 'unpdf';
import { removeUpload, storeUpload } from '@/lib/podcast/storage';
import { getFrontPageQueue } from "@/queue/front_page_queue";
import { and, count, eq, gte, inArray } from 'drizzle-orm';
import { start } from 'workflow/api';
import { generatePodcastWorkflow } from '@/lib/podcast/workflow';
import { reserveApiAccess, releaseApiGrants } from '@/lib/api-access';

export async function POST(req: Request) {
  const user = await getCurrentUser()
  const { userId, userEmail } = user
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
  if (!Object.values(PodcastInputType).includes(type as PodcastInputType) ||
      ![Platform.Minimax, Platform.FishAudio, Platform.Gemini].includes(platform as Platform) || typeof voice_id_1 !== 'string' || !voice_id_1 ||
      typeof voice_id_2 !== 'string' || !voice_id_2) {
    return respErr('输入类型或语音配置无效')
  }
  const taskUuid = genTaskId()
  let fileName: string | undefined
  let fileLocation: string | undefined
  let fileBytes: Buffer | undefined
  let fileExtension: string | undefined
  if (type === PodcastInputType.File && file) {
    if (!(file instanceof File)) return respErr('请选择文件')
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['pdf', 'txt', 'md', 'text'].includes(extension)) return respErr('只支持 PDF、TXT、Markdown')
    if (file.size < 1 || file.size > 4_000_000) return respErr('文件大小须在 4 MB 以内')
    const bytes = Buffer.from(await file.arrayBuffer())
    try {
      if (extension === 'pdf') {
        if (bytes.subarray(0, 5).toString() !== '%PDF-') return respErr('PDF 文件格式无效')
        const document = await getDocumentProxy(new Uint8Array(bytes))
        if (document.numPages > 200) return respErr('PDF 最多支持 200 页')
        const result = await extractText(document, { mergePages: true })
        text = result.text
      } else {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      }
    } catch {
      return respErr('无法提取文件文字；扫描版 PDF 需要先进行 OCR')
    }
    text = text.replace(/\n[\n]+/g, '\n').trim()
    if (!text || text.length > 100_000) return respErr('提取的文字为空或超过 10 万字')
    fileName = file.name.slice(0, 255)
    fileBytes = bytes
    fileExtension = extension
  } else if (text && typeof text === 'string') {
    text = text.trim()
    if (text.length > 100_000) {
      return respErr("invalid params: text is too long");
    }
  }
  if (!text) {
    return respErr("invalid params: text is empty");
  }

  let reservation: Awaited<ReturnType<typeof reserveApiAccess>>
  try {
    reservation = await reserveApiAccess(user, type === PodcastInputType.Topic, platform as Platform)
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'API 权限不足' }),
      { status: 403, headers: { 'content-type': 'application/json' } })
  }
  if (fileBytes && fileExtension) {
    try {
      fileLocation = await storeUpload(`${taskUuid}.${fileExtension}`, fileBytes,
        fileExtension === 'pdf' ? 'application/pdf' : 'text/plain')
    } catch (error) {
      await releaseApiGrants(reservation.grantIds, reservation.memberShareIds)
      return new Response(JSON.stringify({ error: '文件保存失败，请稍后重试' }),
        { status: 500, headers: { 'content-type': 'application/json' } })
    }
  }

  // check credits
  if (process.env.NEXT_PUBLIC_CLERK_ENABLED) {
  }

  // check if there is a pending task
  if (process.env.NEXT_PUBLIC_CLERK_ENABLED) {
  }

  const task: NewTask = {
    userId: userId,
    uuid: taskUuid,
    userEmail: userEmail,
    userInputs: {
      type: type as PodcastInputType,
      text: text as string,
      platform: platform,
      voice_id_1: voice_id_1,
      voice_id_2: voice_id_2,
      language: language as string,
      fileName,
      fileLocation,
      apiAccess: reservation.access,
      apiKeyOwners: reservation.keyOwners,
      apiKeyShareIds: reservation.keyShareIds,
      reservedGrantIds: reservation.grantIds,
      reservedMemberShareIds: reservation.memberShareIds,
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
  try {
    task.id = (await queryWrap(getDb().insert(tasksTable).values(task).returning({ id: tasksTable.id })))[0].id!
  } catch (error) {
    await releaseApiGrants(reservation.grantIds, reservation.memberShareIds)
    if (fileLocation) await removeUpload(fileLocation).catch(() => undefined)
    throw error
  }

  if (process.env.VERCEL === '1') {
    try {
      await start(generatePodcastWorkflow, [task.uuid])
    } catch (error) {
      await getDb().update(tasksTable).set({ status: TaskStatus.Failed,
        statusReason: { msg: '后台任务启动失败' } }).where(eq(tasksTable.id, task.id))
      await releaseApiGrants(reservation.grantIds, reservation.memberShareIds)
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
