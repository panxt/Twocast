import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '../src/db/db'
import { tasksTable } from '../src/db/schema'
import { taskGetStepItem } from '../src/lib/podcast/task'
import { PodcastStep } from '../src/lib/podcast/types'
import { embedScript, normalizeExistingMp3, TimedScriptItem } from '../src/lib/podcast/finalize_mp3'

async function main() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required')
  const tasks = await getDb().select().from(tasksTable).where(eq(tasksTable.status, 'success'))
  let eligible = 0
  let changed = 0
  const headers = { authorization: `Bearer ${key}`, apikey: key }
  const download = async (name: string) => {
    const response = await fetch(`${url}/storage/v1/object/authenticated/podcast-audio/${encodeURIComponent(name)}`, { headers })
    if (!response.ok) throw new Error(`Audio download failed (${response.status})`)
    return Buffer.from(await response.arrayBuffer())
  }
  for (const task of tasks) {
    const audioStep = taskGetStepItem(task, PodcastStep.Audio)
    const location = audioStep?.output?.location as string | undefined
    const lines = audioStep?.output?.timedScript as TimedScriptItem[] | undefined
    const duration = Number(audioStep?.output?.duration)
    const title = String(audioStep?.input?.title || '驿·声笺')
    if (!location?.startsWith('supabase:') || !Array.isArray(lines) || !lines.length || !Number.isFinite(duration)) continue
    eligible++
    const filename = location.slice('supabase:'.length)
    const oldAudio = await download(filename)
    const hasId3 = oldAudio.toString('ascii', 0, 3) === 'ID3'
    const normalized = hasId3
      ? { audio: embedScript(oldAudio, lines, duration, title), duration, timedScript: lines }
      : await normalizeExistingMp3(oldAudio, lines, duration, title)
    if (normalized.audio.equals(oldAudio)) continue
    changed++
    process.stdout.write(`${task.uuid}: metadata update needed; old audio retained${audioStep.output?.backupLocation ? ' (earlier backup exists)' : ''}.\n`)
    if (!process.argv.includes('--apply')) continue
    const replacement = `brand-${task.uuid}.mp3`
    const upload = await fetch(`${url}/storage/v1/object/podcast-audio/${encodeURIComponent(replacement)}`, {
      method: 'POST', headers: { ...headers, 'content-type': 'audio/mpeg', 'x-upsert': 'false' },
      body: new Uint8Array(normalized.audio),
    })
    if (!upload.ok && upload.status !== 400 && upload.status !== 409) {
      throw new Error(`Upload failed for ${task.uuid}: ${upload.status}`)
    }
    const saved = await download(replacement)
    const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
    if (digest(saved) !== digest(normalized.audio)) throw new Error(`Uploaded audio verification failed for ${task.uuid}`)
    const detail = structuredClone(task.stepsDetail) as Record<PodcastStep, { output?: Record<string, unknown> }>
    const priorBackups = [audioStep.output?.backupLocation, ...(audioStep.output?.backupLocations || [])]
      .filter((item): item is string => typeof item === 'string')
    detail[PodcastStep.Audio].output = { ...detail[PodcastStep.Audio].output,
      location: `supabase:${replacement}`, duration: normalized.duration,
      timedScript: normalized.timedScript, backupLocation: location,
      backupLocations: [...new Set([...priorBackups, location])] }
    await getDb().update(tasksTable).set({ stepsDetail: detail, updatedAt: new Date() }).where(eq(tasksTable.id, task.id))
    process.stdout.write(`Updated ${task.uuid}; previous audio retained in private storage.\n`)
  }
  process.stdout.write(`${eligible} eligible successful audio file(s); ${changed} need updating. ${process.argv.includes('--apply') ? 'Repair completed.' : 'Dry run; pass --apply to write.'}\n`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
