import { getShareChain } from '../member-share-chain'

jest.mock('server-only', () => ({}), { virtual: true })

const rows = new Map<number, Record<string, unknown>>()
jest.mock('@/db/db', () => ({ getDb: () => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => {
    const id = currentId()
    return rows.has(id) ? [rows.get(id)] : []
  } }) }) }),
}) }))

let requestedId = 0
function currentId() { return requestedId }
jest.mock('drizzle-orm', () => ({ eq: (_: unknown, id: number) => {
  requestedId = id
  return true
} }))

const share = (id: number, overrides: Record<string, unknown> = {}) => ({
  id, ownerUserId: 1, recipientUserId: id + 1, delegatedByUserId: id === 1 ? 1 : id,
  parentShareId: id === 1 ? null : id - 1, capability: 'tts:minimaxi',
  active: true, allowReshare: true, usedEpisodes: 0, maxEpisodes: 3, ...overrides,
})

describe('revocable member API delegation', () => {
  beforeEach(() => {
    rows.clear()
    rows.set(1, share(1))
    rows.set(2, share(2))
  })

  it('charges the leaf and its owner-controlled upstream share', async () => {
    expect((await getShareChain(2))?.map(item => item.id)).toEqual([2, 1])
  })

  it('immediately blocks downstream access when the owner pauses or disallows delegation', async () => {
    rows.set(1, share(1, { active: false }))
    expect(await getShareChain(2)).toBeNull()
    rows.set(1, share(1, { allowReshare: false }))
    expect(await getShareChain(2)).toBeNull()
  })

  it('blocks a spent upstream allowance and a mismatched delegation', async () => {
    rows.set(1, share(1, { usedEpisodes: 3 }))
    expect(await getShareChain(2)).toBeNull()
    rows.set(1, share(1))
    rows.set(2, share(2, { delegatedByUserId: 99 }))
    expect(await getShareChain(2)).toBeNull()
  })

  it('never lets a MiniMax allowance become a Fish Audio allowance downstream', async () => {
    rows.set(2, share(2, { capability: 'tts:fish_audio' }))
    expect(await getShareChain(2)).toBeNull()
  })
})
