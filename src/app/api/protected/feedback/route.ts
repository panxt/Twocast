import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { guard, viewer, json, parseSubmission, storageCall, FeedbackError } from '@/lib/feedback'
export const runtime = 'nodejs'
export async function GET(req: Request) {
  return guard(async () => {
    const user = await viewer(),
      url = new URL(req.url)
    const page = Math.max(1, Math.min(10000, Math.floor(Number(url.searchParams.get('page'))) || 1))
    const all = user.isAdmin && url.searchParams.get('scope') === 'all'
    const rows = await getDb().execute(
      sql`select id,title,status,author_name,created_at,updated_at,count(*) over()::int as total from feedback_tickets where (${all} or user_id=${user.userId}) order by updated_at desc,id limit 20 offset ${(page - 1) * 20}`
    )
    return json({ tickets: rows, total: rows[0]?.total || 0, isAdmin: user.isAdmin, page })
  })
}
export async function POST(req: Request) {
  return guard(async () => {
    const user = await viewer(),
      { title, content, images } = await parseSubmission(req)
    const id = randomUUID(),
      uploaded: string[] = []
    try {
      const attachments: { key: string; type: string; name: string }[] = []
      for (const img of images) {
        const key = `${id}/${img.key}`
        await storageCall(`object/feedback-images/${key}`, {
          method: 'POST',
          headers: { 'content-type': img.type },
          body: new Uint8Array(img.data),
        })
        uploaded.push(key)
        attachments.push({ key, type: img.type, name: img.name })
      }
      // Serialize admission by user; at most 20 new tickets per day, replies remain available.
      await getDb().transaction(async (db) => {
        await db.execute(sql`select pg_advisory_xact_lock(7110,${user.userId})`)
        const [n] = await db.execute(
          sql`select count(*)::int as n from feedback_tickets where user_id=${user.userId} and created_at>now()-interval '24 hours'`
        )
        if (Number(n.n) >= 20)
          throw new FeedbackError('24 小时内最多新建 20 个工单，请在原工单补充问题', 429)
        await db.execute(
          sql`insert into feedback_tickets(id,user_id,author_name,title,content,attachments) values(${id}::uuid,${user.userId},${user.displayName || '成员'},${title},${content},${JSON.stringify(attachments)}::jsonb)`
        )
      })
      return json({ id })
    } catch (e) {
      if (uploaded.length)
        await storageCall('object/feedback-images', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prefixes: uploaded }),
        }).catch(() => undefined)
      throw e
    }
  })
}
