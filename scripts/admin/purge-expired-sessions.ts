import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '../../src/db/db'
import { sessionsTable } from '../../src/db/schema'
import { staleAdminSessionFilter } from '../../src/lib/admin-sessions'

// 清理早已过期、且没有节目引用的管理员会话行（成员行不动：它们同时是账号）。
// 用法：npx tsx scripts/admin/purge-expired-sessions.ts [--apply] [--days 7]
async function main() {
  const apply = process.argv.includes('--apply')
  const daysArg = process.argv.indexOf('--days')
  const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 7
  if (!Number.isFinite(days) || days < 0) throw new Error('--days 必须是非负数字')
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const db = getDb()
  const where = staleAdminSessionFilter(-1, cutoff)
  const candidates = await db.select({ id: sessionsTable.id, expiresAt: sessionsTable.expiresAt }).from(sessionsTable).where(where)
  const live = await db.select({ id: sessionsTable.id }).from(sessionsTable)
    .where(and(eq(sessionsTable.role, 'admin'), sql`${sessionsTable.expiresAt} > NOW()`))
  process.stdout.write(`有效管理员会话 ${live.length} 个；过期超过 ${days} 天且无节目引用的管理员会话 ${candidates.length} 个。\n`)
  if (!apply) { process.stdout.write('试运行，未删除；加 --apply 执行。\n'); return }
  const removed = await db.delete(sessionsTable).where(where).returning({ id: sessionsTable.id })
  process.stdout.write(`已删除 ${removed.length} 个过期管理员会话。\n`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
