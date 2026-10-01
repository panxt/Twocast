import { randomUUID } from 'node:crypto'
import { and, eq, gt, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/utils/user'
import { getDb } from '@/db/db'
import { importTicketsTable } from '@/db/schema'
import { parseSubtitles } from '@/lib/podcast/subtitles'
import { finalizeMp3, embedScript } from '@/lib/podcast/finalize_mp3'
import { storeAudio, removeAudio } from '@/lib/podcast/storage'
import { admitTask } from '@/lib/quotas'
import { TaskStatus } from '@/types/task'
export const runtime = 'nodejs'
export const maxDuration = 300
function config() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('导入需要配置 Supabase 私有存储')
  return { url, headers: { authorization: `Bearer ${key}`, apikey: key } }
}
async function cleanup(id: string) {
  const { url, headers } = config()
  await fetch(`${url}/storage/v1/object/podcast-imports`, {
    method: 'DELETE',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [id] }),
  })
}
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user.userEmail || !user.userId) return Response.json({ error: '请先登录' }, { status: 401 })
  const b = await req.json().catch(() => null)
  if (
    !b ||
    typeof b.filename !== 'string' ||
    !/\.(mp3|wav)$/i.test(b.filename) ||
    !Number.isInteger(b.bytes) ||
    b.bytes < 1 ||
    b.bytes > 50000000
  )
    return Response.json({ error: '支持 MP3 / WAV，大小须在 50 MB 以内' }, { status: 400 })
  try {
    const { url, headers } = config()
    // Limit unclaimed staging uploads per user; signed URLs grant only this unique path.
    const [pending] = await getDb()
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(importTicketsTable)
      .where(
        and(
          eq(importTicketsTable.userId, user.userId),
          eq(importTicketsTable.state, 'pending'),
          gt(importTicketsTable.createdAt, new Date(Date.now() - 7200000))
        )
      )
    if (pending.n >= 5)
      return Response.json({ error: '未完成上传较多，请稍后再试' }, { status: 429 })
    const id = `${randomUUID()}.${b.filename.split('.').pop().toLowerCase()}`
    const response = await fetch(`${url}/storage/v1/object/upload/sign/podcast-imports/${id}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: '{}',
    })
    if (!response.ok) throw new Error('创建上传链接失败')
    const data = await response.json()
    const uploadUrl = new URL(
      data.url.startsWith('http') ? data.url : `/storage/v1${data.url}`,
      url
    ).toString()
    await getDb()
      .insert(importTicketsTable)
      .values({ id, userId: user.userId, filename: b.filename.slice(0, 255), bytes: b.bytes })
    return Response.json(
      {
        id,
        uploadUrl,
        contentType: b.filename.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg',
      },
      { headers: { 'cache-control': 'no-store' } }
    )
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '导入失败' }, { status: 500 })
  }
}
export async function PUT(req: Request) {
  const user = await getCurrentUser()
  if (!user.userEmail || !user.userId) return Response.json({ error: '请先登录' }, { status: 401 })
  const b = await req.json().catch(() => null)
  if (
    !b ||
    typeof b.ticketId !== 'string' ||
    typeof b.title !== 'string' ||
    !b.title.trim() ||
    b.title.length > 200 ||
    typeof b.subtitles !== 'string' ||
    (b.teamId !== null &&
      (!Number.isInteger(b.teamId) ||
        b.teamId < 1 ||
        (!user.isAdmin && !user.teamIds.includes(b.teamId))))
  )
    return Response.json({ error: '导入参数无效' }, { status: 400 })
  let lines: ReturnType<typeof parseSubtitles>
  try {
    lines = parseSubtitles(b.subtitles)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : '字幕无效' }, { status: 400 })
  }
  const db = getDb()
  const [ticket] = await db
    .update(importTicketsTable)
    .set({ state: 'processing' })
    .where(
      and(
        eq(importTicketsTable.id, b.ticketId),
        eq(importTicketsTable.userId, user.userId),
        eq(importTicketsTable.state, 'pending'),
        gt(importTicketsTable.createdAt, new Date(Date.now() - 7200000))
      )
    )
    .returning()
  if (!ticket) return Response.json({ error: '上传已处理、过期或不存在' }, { status: 409 })
  let outputName = ''
  try {
    const { url, headers } = config()
    const response = await fetch(
      `${url}/storage/v1/object/authenticated/podcast-imports/${ticket.id}`,
      { headers }
    )
    if (!response.ok) throw new Error('音频尚未上传完成')
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length !== ticket.bytes || buffer.length > 50000000)
      throw new Error('音频大小与上传声明不符')
    const isWav =
      buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WAVE'
    const isMp3 =
      buffer.subarray(0, 3).toString() === 'ID3' || (buffer[0] === 255 && (buffer[1] & 224) === 224)
    if (!isWav && !isMp3) throw new Error('文件内容不是有效的 MP3 / WAV')
    const normalized = await finalizeMp3([buffer], [{ role: '讲述', text: '' }], b.title)
    if (lines.some((l) => l.startMs >= normalized.duration * 1000))
      throw new Error('字幕时间超出音频时长，请检查时间戳')
    const audio = embedScript(normalized.audio, lines, normalized.duration, b.title)
    const uuid = `import-${randomUUID()}`
    outputName = `${uuid}.mp3`
    const location = await storeAudio(outputName, audio)
    await admitTask(
      user,
      {
        uuid,
        userId: user.userId,
        userEmail: user.userEmail,
        status: TaskStatus.Success,
        consumedCredits: 0,
        createdAt: new Date(),
        userInputs: { text: b.title },
        stepsDetail: {
          audio: {
            input: {
              title: b.title,
              outline: '导入音频',
              key_points: [],
              script: lines.map((l) => ({ role: l.role, text: l.text })),
            },
            output: { location, duration: normalized.duration, timedScript: lines },
          },
        },
      },
      b.teamId,
      audio.length,
      'import'
    )
    await db
      .update(importTicketsTable)
      .set({ state: 'complete' })
      .where(eq(importTicketsTable.id, ticket.id))
    await cleanup(ticket.id).catch(() => undefined)
    return Response.json({ ok: true, uuid })
  } catch (e) {
    if (outputName) await removeAudio([outputName]).catch(() => undefined)
    await db
      .update(importTicketsTable)
      .set({ state: 'pending' })
      .where(eq(importTicketsTable.id, ticket.id))
    return Response.json({ error: e instanceof Error ? e.message : '导入失败' }, { status: 400 })
  }
}
