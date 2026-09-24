import { eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { tasksTable } from '@/db/schema'
import { getTaskByUuid } from '@/models/task'
import { PodcastInputType, TaskUserInput } from './types'
import { processTopicTask } from '@/queue/topic_queue'
import { processLinkTask } from '@/queue/link_queue'
import { processFrontPageTask } from '@/queue/front_page_queue'
import { processLongTextTask } from '@/queue/long_text_queue'
import { taskGetStepItem, taskUpdateStepItem } from './task'
import { PodcastStep, Platform, ScriptItem } from './types'
import { LongTextResult } from '@/queue/types'
import { genVoiceMinimax } from './audio_parts'
import { finalizeMp3 } from './finalize_mp3'
import { readAudio, removeAudio, storeAudio } from './storage'
import { TaskStatus } from '@/types/task'
import { withApiContext } from '@/lib/api-context'

async function loadTask(uuid: string) {
  const task = await getTaskByUuid(uuid)
  if (!task) throw new Error(`Task ${uuid} not found`)
  return task
}

async function prepareInput(uuid: string) {
  'use step'
  const task = await loadTask(uuid)
  const type = (task.userInputs as TaskUserInput).type
  const access = (task.userInputs as TaskUserInput).apiAccess || { llm: 'admin' as const, tts: 'admin' as const }
  await withApiContext({ userId: task.userId, access }, async () => {
    if (type === PodcastInputType.Topic) await processTopicTask(task, false)
    else if (type === PodcastInputType.Link) await processLinkTask(task, false)
    else if (type === PodcastInputType.FrontPage) await processFrontPageTask(task, false)
    else if (type !== PodcastInputType.LongText && type !== PodcastInputType.File) throw new Error(`Unsupported input type: ${type}`)
  })
  return uuid
}

async function writeScript(uuid: string) {
  'use step'
  const task = await loadTask(uuid)
  const access = (task.userInputs as TaskUserInput).apiAccess || { llm: 'admin' as const, tts: 'admin' as const }
  await withApiContext({ userId: task.userId, access }, () => processLongTextTask(task, false))
  return uuid
}

async function getAudioPlan(uuid: string) {
  'use step'
  const task = await loadTask(uuid)
  const inputs = task.userInputs as TaskUserInput
  if (inputs.platform !== Platform.Minimax) throw new Error('Vercel beta currently supports MiniMax TTS only')
  const step = taskGetStepItem(task, PodcastStep.Audio)
  const result = step.input as LongTextResult
  if (!result?.script?.length) throw new Error('No generated script')
  return { script: result.script, voiceIds: [inputs.voice_id_1!, inputs.voice_id_2!] }
}

async function generateAudioSegment(uuid: string, index: number, line: ScriptItem, voiceId: string) {
  'use step'
  const task = await loadTask(uuid)
  const access = (task.userInputs as TaskUserInput).apiAccess || { llm: 'admin' as const, tts: 'admin' as const }
  const audio = await withApiContext({ userId: task.userId, access }, () => genVoiceMinimax(line.text, { id: voiceId }))
  const filename = `tmp-${uuid}-${index}.mp3`
  await storeAudio(filename, audio.audio)
  return filename
}

async function finalizeAudio(uuid: string, files: string[], script: ScriptItem[]) {
  'use step'
  const parts = await Promise.all(files.map(readAudio))
  const task = await loadTask(uuid)
  const scriptResult = taskGetStepItem(task, PodcastStep.Audio).input as LongTextResult
  const result = await finalizeMp3(parts, script, scriptResult?.title || 'ToCast 播客')
  const location = await storeAudio(`${uuid}.mp3`, result.audio)
  taskUpdateStepItem(task, PodcastStep.Audio, {
    output: { location, duration: result.duration, timedScript: result.timedScript },
  })
  await getDb().update(tasksTable).set({
    stepsDetail: task.stepsDetail, status: TaskStatus.Success, updatedAt: new Date(),
  }).where(eq(tasksTable.id, task.id))
  await removeAudio(files).catch(error => console.warn('Temporary audio cleanup failed', error))
}

async function cleanTemporaryAudio(uuid: string, count: number) {
  'use step'
  await removeAudio(Array.from({ length: count }, (_, index) => `tmp-${uuid}-${index}.mp3`))
}

async function markFailed(uuid: string, reason: string) {
  'use step'
  await getDb().update(tasksTable).set({
    status: TaskStatus.Failed, statusReason: { msg: reason.slice(0, 300) }, updatedAt: new Date(),
  }).where(eq(tasksTable.uuid, uuid))
}

export async function generatePodcastWorkflow(uuid: string) {
  'use workflow'
  let segmentCount = 0
  try {
    await prepareInput(uuid)
    await writeScript(uuid)
    const plan = await getAudioPlan(uuid)
    segmentCount = plan.script.length
    const files: string[] = []
    for (let index = 0; index < plan.script.length; index++) {
      files.push(await generateAudioSegment(uuid, index, plan.script[index], plan.voiceIds[index % 2]))
    }
    await finalizeAudio(uuid, files, plan.script)
  } catch (error) {
    if (segmentCount) await cleanTemporaryAudio(uuid, segmentCount).catch(() => undefined)
    await markFailed(uuid, error instanceof Error ? error.message : String(error))
    throw error
  }
}
