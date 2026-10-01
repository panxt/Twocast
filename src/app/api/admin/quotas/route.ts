import { sql } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { quotaPoliciesTable } from '@/db/schema'
import { getCurrentUser } from '@/utils/user'
export async function GET() {
  if (!(await getCurrentUser()).isAdmin)
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  return Response.json({ policies: await getDb().select().from(quotaPoliciesTable) })
}
export async function PUT(req: Request) {
  if (!(await getCurrentUser()).isAdmin)
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => null)
  if (
    !b ||
    !['platform', 'default', 'user', 'team'].includes(b.scope) ||
    !Number.isInteger(b.scopeId) ||
    b.scopeId < 0 ||
    (['platform', 'default'].includes(b.scope) && b.scopeId !== 0) ||
    (['user', 'team'].includes(b.scope) && b.scopeId < 1)
  )
    return Response.json({ error: '额度对象无效' }, { status: 400 })
  for (const key of ['dailyLimit', 'totalLimit', 'concurrentLimit', 'storageBytes'])
    if (b[key] !== null && (!Number.isSafeInteger(b[key]) || b[key] < 0))
      return Response.json({ error: '额度须为非负整数，留空表示不限量' }, { status: 400 })
  const values = {
    scope: b.scope,
    scopeId: b.scopeId,
    dailyLimit: b.dailyLimit,
    totalLimit: b.totalLimit,
    concurrentLimit: b.concurrentLimit,
    storageBytes: b.storageBytes,
  }
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(86470123)`)
    await tx
      .insert(quotaPoliciesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [quotaPoliciesTable.scope, quotaPoliciesTable.scopeId],
        set: values,
      })
  })
  return Response.json({ ok: true })
}
