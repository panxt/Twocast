import 'server-only'
import { eq } from 'drizzle-orm'
import { getDb } from '@/db/db'
import { memberApiSharesTable } from '@/db/schema'

type Share = typeof memberApiSharesTable.$inferSelect

// A child never receives a key. It only points at its parent's revocable allowance.
export async function getShareChain(id: number, requireAvailable = true): Promise<Share[] | null> {
  const chain: Share[] = []
  const seen = new Set<number>()
  let next: number | null = id
  while (next !== null && chain.length < 16) {
    if (seen.has(next)) return null
    seen.add(next)
    const [share] = await getDb().select().from(memberApiSharesTable)
      .where(eq(memberApiSharesTable.id, next)).limit(1)
    if (!share?.active || (requireAvailable && share.usedEpisodes >= share.maxEpisodes)) return null
    const child = chain[chain.length - 1]
    if (child && (!share.allowReshare || child.delegatedByUserId !== share.recipientUserId ||
      child.ownerUserId !== share.ownerUserId || child.capability !== share.capability)) return null
    chain.push(share)
    next = share.parentShareId
  }
  if (next !== null) return null
  const root = chain[chain.length - 1]
  if (!root || root.delegatedByUserId !== root.ownerUserId) return null
  return chain
}
