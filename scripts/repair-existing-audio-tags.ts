import { eq } from 'drizzle-orm'
import { getDb } from '../src/db/db'
import { tasksTable } from '../src/db/schema'
import { taskGetStepItem } from '../src/lib/podcast/task'
import { PodcastStep } from '../src/lib/podcast/types'
import { normalizeExistingMp3, TimedScriptItem } from '../src/lib/podcast/finalize_mp3'

async function main() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required')
  const tasks = await getDb().select().from(tasksTable).where(eq(tasksTable.status, 'success'))
  let eligible = 0
  for (const task of tasks) {
    const audioStep = taskGetStepItem(task, PodcastStep.Audio)
    const location = audioStep?.output?.location as string | undefined
    const lines = audioStep?.output?.timedScript as TimedScriptItem[] | undefined
    const duration = Number(audioStep?.output?.duration)
    const title = String(audioStep?.input?.title || 'ToCast 播客')
    if (!location?.startsWith('supabase:') || !Array.isArray(lines) || !lines.length || !Number.isFinite(duration)) continue
    eligible++
    if (!process.argv.includes('--apply')) continue
    const filename = location.slice('supabase:'.length)
    const headers = { authorization: `Bearer ${key}`, apikey: key }
    const downloaded = await fetch(`${url}/storage/v1/object/authenticated/podcast-audio/${encodeURIComponent(filename)}`, { headers })
    if (!downloaded.ok) throw new Error(`Download failed for ${task.uuid}: ${downloaded.status}`)
    const oldAudio = Buffer.from(await downloaded.arrayBuffer())
    if (oldAudio.includes(Buffer.from('TIT2'))) continue
    const normalized = await normalizeExistingMp3(oldAudio, lines, duration, title)
    const backup = `backup-${filename}`
    const upload = async (name: string, bytes: Buffer, upsert: boolean) => {
      const response = await fetch(`${url}/storage/v1/object/podcast-audio/${encodeURIComponent(name)}`, {
        method: 'POST', headers: { ...headers, 'content-type': 'audio/mpeg', 'x-upsert': String(upsert) },
        body: new Uint8Array(bytes),
      })
      if (!response.ok) throw new Error(`Upload failed for ${name}: ${response.status}`)
    }
    await upload(backup, oldAudio, false)
    await upload(filename, normalized.audio, true)
    const detail = structuredClone(task.stepsDetail) as Record<PodcastStep, { output?: Record<string, unknown> }>
    detail[PodcastStep.Audio].output = { ...detail[PodcastStep.Audio].output,
      duration: normalized.duration, timedScript: normalized.timedScript, backupLocation: `supabase:${backup}` }
    await getDb().update(tasksTable).set({ stepsDetail: detail, updatedAt: new Date() }).where(eq(tasksTable.id, task.id))
    process.stdout.write(`Updated ${task.uuid}; backup retained in private storage.\n`)
  }
  process.stdout.write(`${eligible} eligible successful audio file(s). ${process.argv.includes('--apply') ? 'Repair completed.' : 'Dry run; pass --apply to write.'}\n`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
