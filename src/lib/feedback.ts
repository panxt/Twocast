import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { getCurrentUser } from '@/utils/user'
export type FeedbackUser = Awaited<ReturnType<typeof getCurrentUser>>
export class FeedbackError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}
export function canReadTicket(user: Pick<FeedbackUser, 'userId' | 'isAdmin'>, owner: number) {
  return user.isAdmin || user.userId === owner
}
export async function viewer() {
  const user = await getCurrentUser()
  if (!user.userEmail) throw new FeedbackError('请先登录', 401)
  return user
}
export async function guard(action: () => Promise<Response>) {
  try {
    return await action()
  } catch (e) {
    if (e instanceof FeedbackError) return Response.json({ error: e.message }, { status: e.status })
    console.error('[feedback] request failed', e instanceof Error ? e.name : 'UnknownError')
    return Response.json({ error: '工单服务暂时不可用，请稍后重试' }, { status: 503 })
  }
}
export function json(body: unknown) {
  return Response.json(body, { headers: { 'cache-control': 'private, no-store' } })
}
export function imageType(data: Buffer) {
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png'
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg'
  if (
    data.length >= 12 &&
    data.subarray(0, 4).toString() === 'RIFF' &&
    data.subarray(8, 12).toString() === 'WEBP'
  )
    return 'image/webp'
  throw new FeedbackError('仅支持 PNG、JPEG、WebP 图片，不支持视频或 SVG')
}
export function storage() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new FeedbackError('图片存储尚未配置', 503)
  return { url, headers: { authorization: `Bearer ${key}`, apikey: key } }
}
export async function storageCall(path: string, init: RequestInit = {}) {
  const { url, headers } = storage()
  const response = await fetch(`${url}/storage/v1/${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new FeedbackError('图片存储暂时无法响应，请稍后重试', 503)
  return response
}
export async function ticketFor(
  user: FeedbackUser,
  id: string,
  db: Pick<ReturnType<typeof getDb>, 'execute'> = getDb(),
  lock = false
) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new FeedbackError('工单不存在', 404)
  const rows = await db.execute(
    sql`select * from feedback_tickets where id=${id}::uuid and (${user.isAdmin} or user_id=${user.userId}) ${lock ? sql`for update` : sql``}`
  )
  if (!rows.length || !canReadTicket(user, Number(rows[0].user_id)))
    throw new FeedbackError('工单不存在或无权访问', 404)
  return rows[0] as Record<string, any>
}
export async function parseSubmission(req: Request) {
  if (Number(req.headers.get('content-length')) > 4000000)
    throw new FeedbackError('图片合计不能超过 3 MB', 413)
  const form = await req.formData().catch(() => {
    throw new FeedbackError('提交格式无效')
  })
  const title = String(form.get('title') || '').trim(),
    content = String(form.get('content') || '').trim()
  if (!title || title.length > 120 || !content || content.length > 10000)
    throw new FeedbackError('标题限 1–120 字，内容限 1–10000 字')
  const files = form.getAll('images').filter((f): f is File => typeof f !== 'string' && f.size > 0)
  if (files.length > 3 || files.reduce((n, f) => n + f.size, 0) > 3145728)
    throw new FeedbackError('最多 3 张图片，合计不超过 3 MB', 413)
  const images: { data: Buffer; type: string; name: string; key: string }[] = []
  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer())
    const type = imageType(data)
    images.push({ data, type, name: file.name.slice(0, 120), key: randomUUID() })
  }
  return { title, content, images }
}
