import { and, eq, inArray, sql } from 'drizzle-orm'
import { voiceForRole, voiceMapFor } from './voices'
import { getDb } from '@/db/db'
import { apiGrantsTable, memberApiSharesTable, tasksTable } from '@/db/schema'
import { getTaskByUuid } from '@/models/task'
import { PodcastInputType, TaskUserInput } from './types'
import { processTopicTask } from '@/queue/topic_queue'
import { processLinkTask } from '@/queue/link_queue'
import { processFrontPageTask } from '@/queue/front_page_queue'
import { processLongTextTask } from '@/queue/long_text_queue'
import { taskGetStepItem, taskUpdateStepItem } from './task'
import { PodcastStep, Platform, ScriptItem } from './types'
import { LongTextResult } from '@/queue/types'
import { genVoiceMinimax, genVoiceFishAudio, genVoiceGemini } from './audio_parts'
import { finalizeMp3 } from './finalize_mp3'
import { readAudio, removeAudio, storeAudio } from './storage'
import { TaskStatus } from '@/types/task'
import { withApiContext } from '@/lib/api-context'

async function loadTask(uuid: string) {
  const task = await getTaskByUuid(uuid)
  if (!task) throw new Error(`Task ${uuid} not found`)
  return task
}

async function updateProgress(taskId: number, stage: 'preparing' | 'script' | 'audio' | 'finalizing', current?: number, total?: number) {
  const now = new Date()
  await getDb().update(tasksTable).set({
    status: TaskStatus.Processing, currentStep: stage, statusAt: now, updatedAt: now,
    result: { progress: { stage, current, total } },
  }).where(eq(tasksTable.id, taskId))
}

async function prepareInput(uuid: string) {
  'use step'
  const task = await loadTask(uuid)
  await updateProgress(task.id, 'preparing')
  const type = (task.userInputs as TaskUserInput).type
  const access = (task.userInputs as TaskUserInput).apiAccess || { llm: 'admin' as const, tts: 'admin' as const }
  const inputs = task.userInputs as TaskUserInput
  await withApiContext({ userId: task.userId, access, keyOwners: inputs.apiKeyOwners, keyShareIds: inputs.apiKeyShareIds }, async () => {
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
  await updateProgress(task.id, 'script')
  const access = (task.userInputs as TaskUserInput).apiAccess || { llm: 'admin' as const, tts: 'admin' as const }
  const inputs = task.userInputs as TaskUserInput
  await withApiContext({ userId: task.userId, access, keyOwners: inputs.apiKeyOwners, keyShareIds: inputs.apiKeyShareIds }, () => processLongTextTask(task, false))
  return uuid
}

async function getAudioPlan(uuid: string) {
  'use step'
  const task = await loadTask(uuid)
  const inputs = task.userInputs as TaskUserInput
  if (![Platform.Minimax, Platform.FishAudio, Platform.Gemini].includes(inputs.platform as Platform)) {
    throw new Error('不支持的语音平台')
  }
  const step = taskGetStepItem(task, PodcastStep.Audio)
  const result = step.input as LongTextResult
  if (!result?.script?.length) throw new Error('No generated script')
  await updateProgress(task.id, 'audio', 0, result.script.length)
  return { script: result.script, voices: voiceMapFor(inputs) }
}

async function generateAudioSegment(uuid: string, index: number, total: number, line: ScriptItem, voiceId: string) {
  'use step'
  const task = await loadTask(uuid)
  const access = (task.userInputs as TaskUserInput).apiAccess || { llm: 'admin' as const, tts: 'admin' as const }
  const inputs = task.userInputs as TaskUserInput
  const synthesize = inputs.platform === Platform.FishAudio ? genVoiceFishAudio
    : inputs.platform === Platform.Gemini ? genVoiceGemini : genVoiceMinimax
  const audio = await withApiContext({ userId: task.userId, access, keyOwners: inputs.apiKeyOwners, keyShareIds: inputs.apiKeyShareIds }, () => synthesize(line.text, { id: voiceId }))
  const filename = `tmp-${uuid}-${index}.mp3`
  await storeAudio(filename, audio.audio)
  await updateProgress(task.id, 'audio', index + 1, total)
  return filename
}

async function finalizeAudio(uuid: string, files: string[], script: ScriptItem[]) {
  'use step'
  const task = await loadTask(uuid)
  await updateProgress(task.id, 'finalizing')
  const parts = await Promise.all(files.map(readAudio))
  const scriptResult = taskGetStepItem(task, PodcastStep.Audio).input as LongTextResult
  const result = await finalizeMp3(parts, script, scriptResult?.title || '驿·声笺')
  const location = await storeAudio(`${uuid}.mp3`, result.audio)
  taskUpdateStepItem(task, PodcastStep.Audio, {
    output: { location, duration: result.duration, timedScript: result.timedScript },
  })
  await getDb().update(tasksTable).set({
    stepsDetail: task.stepsDetail, status: TaskStatus.Success, currentStep: 'complete',
    statusAt: new Date(), updatedAt: new Date(),
  }).where(eq(tasksTable.id, task.id))
  await removeAudio(files).catch(error => console.warn('Temporary audio cleanup failed', error))
}

async function cleanTemporaryAudio(uuid: string, count: number) {
  'use step'
  await removeAudio(Array.from({ length: count }, (_, index) => `tmp-${uuid}-${index}.mp3`))
}

async function markFailed(uuid: string, reason: string) {
  'use step'
  await getDb().transaction(async tx => {
    // A retry must not return the same reserved grant twice.
    const [failed] = await tx.update(tasksTable).set({
      status: TaskStatus.Failed, currentStep: 'failed', statusAt: new Date(),
      statusReason: { msg: reason.slice(0, 300) }, updatedAt: new Date(),
    }).where(and(eq(tasksTable.uuid, uuid),
      inArray(tasksTable.status, [TaskStatus.Pending, TaskStatus.Processing])))
      .returning({ userInputs: tasksTable.userInputs })
    if (!failed) return
    const grantIds = (failed.userInputs as TaskUserInput | null)?.reservedGrantIds || []
    for (const id of new Set(grantIds)) {
      if (!Number.isInteger(id) || id < 1) continue
      await tx.update(apiGrantsTable)
        .set({ usedEpisodes: sql`GREATEST(0, ${apiGrantsTable.usedEpisodes} - 1)` })
        .where(eq(apiGrantsTable.id, id))
    }
    const shareIds = (failed.userInputs as TaskUserInput | null)?.reservedMemberShareIds || []
    for (const id of new Set(shareIds)) {
      if (!Number.isInteger(id) || id < 1) continue
      await tx.update(memberApiSharesTable)
        .set({ usedEpisodes: sql`GREATEST(0, ${memberApiSharesTable.usedEpisodes} - 1)` })
        .where(eq(memberApiSharesTable.id, id))
    }
  })
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
      files.push(await generateAudioSegment(uuid, index, plan.script.length, plan.script[index], voiceForRole(plan.script[index].role, plan.voices)))
    }
    await finalizeAudio(uuid, files, plan.script)
  } catch (error) {
    if (segmentCount) await cleanTemporaryAudio(uuid, segmentCount).catch(() => undefined)
    await markFailed(uuid, error instanceof Error ? error.message : String(error))
    throw error
  }
}
