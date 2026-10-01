import { getDb } from '@/db/db'
import { eq, sql } from 'drizzle-orm'
import { tasksTable, quotaReservationsTable } from '@/db/schema'
import { removeAudio, removeUpload, removeCover } from '@/lib/podcast/storage'
import { getCurrentUser } from '@/utils/user'
export async function POST() {
  if (!(await getCurrentUser()).isAdmin)
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  return cleanup()
}
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  return cleanup()
}
async function cleanup() {
  const db = getDb()
  // Never touch final audio or any active workflow's segments.
  const files = await db.execute(
    sql`select o.bucket_id as bucket,o.name from storage.objects o where o.created_at < now()-interval '1 day' and (o.bucket_id='podcast-imports' or (o.bucket_id='podcast-audio' and o.name like 'tmp-%' and exists(select 1 from public.tasks t where o.name like 'tmp-'||t.uuid||'-%' and t.status in ('success','failed')))) limit 500`
  )
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return Response.json({ error: '存储尚未配置' }, { status: 503 })
  const expired = await db
    .select()
    .from(tasksTable)
    .where(sql`${tasksTable.deletedAt}<now()-interval '7 days'`)
    .limit(50)
  for (const task of expired) {
    const audio = (
      task.stepsDetail as {
        audio?: {
          output?: { location?: string; backupLocation?: string; backupLocations?: string[] }
        }
      }
    )?.audio?.output
    const names = [
      ...new Set([audio?.location, audio?.backupLocation, ...(audio?.backupLocations || [])]),
    ]
      .filter((v): v is string => Boolean(v?.startsWith('supabase:')))
      .map((v) => v.slice(9))
    await removeAudio(names)
    const file = (task.userInputs as { fileLocation?: string })?.fileLocation
    if (file) await removeUpload(file)
    if (task.coverLocation) await removeCover(task.coverLocation)
    await db.transaction(async (tx) => {
      if (task.status === 'failed')
        await tx
          .update(quotaReservationsTable)
          .set({ cancelled: true })
          .where(eq(quotaReservationsTable.uuid, task.uuid))
      await tx.delete(tasksTable).where(eq(tasksTable.id, task.id))
    })
  }
  let removed = 0
  for (const bucket of ['podcast-imports', 'podcast-audio']) {
    const names = files.filter((f) => f.bucket === bucket).map((f) => String(f.name))
    if (!names.length) continue
    const response = await fetch(`${url}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${key}`, apikey: key, 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: names }),
    })
    if (!response.ok)
      return Response.json({ error: '临时文件清理失败，请稍后重试' }, { status: 502 })
    removed += names.length
  }
  await db.execute(sql`delete from public.import_tickets where created_at < now()-interval '1 day'`)
  await db.execute(sql`delete from public.device_sessions where expires_at<now()`)
  return Response.json({ ok: true, removed, purged: expired.length })
}
