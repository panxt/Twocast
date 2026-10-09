import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { guard, viewer, json, ticketFor, FeedbackError } from '@/lib/feedback'
type Context = { params: Promise<{ id: string }> }
export async function GET(_req: Request, context: Context) {
  return guard(async () => {
    const user = await viewer(),
      { id } = await context.params,
      ticket = await ticketFor(user, id)
    const messages = await getDb().execute(
      sql`select id,author_name,is_admin,content,created_at from feedback_messages where ticket_id=${id}::uuid order by created_at,id`
    )
    const attachments = (ticket.attachments || []).map((a: any, index: number) => ({
      name: a.name,
      url: `/api/protected/feedback/${id}/attachments/${index}`,
    }))
    return json({ ticket: { ...ticket, attachments }, messages, isAdmin: user.isAdmin })
  })
}
export async function POST(req: Request, context: Context) {
  return guard(async () => {
    const user = await viewer(),
      { id } = await context.params,
      b = await req.json().catch(() => null)
    if (typeof b?.content !== 'string' || !b.content.trim() || b.content.length > 10000)
      throw new FeedbackError('回复限 1–10000 字')
    await getDb().transaction(async (db) => {
      const ticket = await ticketFor(user, id, db, true)
      if (ticket.status === 'closed')
        throw new FeedbackError('工单已关闭，请联系管理员重新打开后补充', 409)
      await db.execute(
        sql`insert into feedback_messages(id,ticket_id,user_id,author_name,is_admin,content) values(${randomUUID()}::uuid,${id}::uuid,${user.userId},${user.displayName || '成员'},${user.isAdmin},${b.content.trim()})`
      )
      await db.execute(sql`update feedback_tickets set updated_at=now() where id=${id}::uuid`)
    })
    return json({ ok: true })
  })
}
export async function PATCH(req: Request, context: Context) {
  return guard(async () => {
    const user = await viewer()
    if (!user.isAdmin) throw new FeedbackError('仅管理员可以修改工单状态', 403)
    const { id } = await context.params,
      b = await req.json().catch(() => null)
    if (!['open', 'processing', 'closed'].includes(b?.status)) throw new FeedbackError('状态无效')
    await getDb().transaction(async (db) => {
      const ticket = await ticketFor(user, id, db, true)
      if (ticket.status === b.status) return
      await db.execute(
        sql`update feedback_tickets set status=${b.status},updated_at=now() where id=${id}::uuid`
      )
      const label =
        { open: '重新打开工单', processing: '开始处理工单', closed: '关闭工单' }[
          b.status as string
        ] || '修改状态'
      await db.execute(
        sql`insert into feedback_messages(id,ticket_id,user_id,author_name,is_admin,content) values(${randomUUID()}::uuid,${id}::uuid,${user.userId},${user.displayName || '管理员'},true,${label})`
      )
    })
    return json({ ok: true })
  })
}
