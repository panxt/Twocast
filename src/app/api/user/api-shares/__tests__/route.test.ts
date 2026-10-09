import { POST } from '../route'

const mockRows = jest.fn()
const mockValues = jest.fn()
const mockChain = jest.fn()
jest.mock('@/utils/user', () => ({
  getCurrentUser: async () => ({
    userEmail: 'member@test.invalid',
    userId: 10,
    teamIds: [],
    isSuperAdmin: false,
  }),
}))
jest.mock('@/db/db', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: mockRows }) }) }),
    insert: () => ({ values: mockValues }),
  }),
}))
jest.mock('@/lib/settings', () => ({
  getUserSettings: async () => ({ MINIMAX_TOKEN: 'test', MINIMAX_GROUP_ID: 'test' }),
}))
jest.mock('@/lib/member-share-chain', () => ({
  getShareChain: (...args: unknown[]) => mockChain(...args),
}))
const req = (parentShareId?: number) =>
  ({
    json: async () => ({
      capability: 'tts:minimaxi',
      recipientUserId: 20,
      maxEpisodes: 2,
      parentShareId,
    }),
  }) as Parameters<typeof POST>[0]
describe('explicit sharing in the common beta workspace', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRows.mockResolvedValueOnce([{ id: 20 }]).mockResolvedValueOnce([{ id: 10 }])
    mockValues.mockReturnValue({ returning: async () => [{ id: 1 }] })
  })
  it('allows the key owner to grant a named beta member without a default team', async () => {
    expect((await POST(req())).status).toBe(200)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 10, recipientUserId: 20, parentShareId: null })
    )
  })
  it('still blocks resharing when the original owner has not allowed it', async () => {
    mockChain.mockResolvedValue([
      { recipientUserId: 10, allowReshare: false, capability: 'tts:minimaxi', ownerUserId: 30 },
    ])
    expect((await POST(req(3))).status).toBe(403)
    expect(mockValues).not.toHaveBeenCalled()
  })
})
