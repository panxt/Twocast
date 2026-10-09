import { GET, POST, PATCH } from '../[id]/route'
import { GET as attachment } from '../[id]/attachments/[index]/route'
import { imageType } from '@/lib/feedback'
const mockUser = jest.fn(),
  mockExecute = jest.fn()
jest.mock('@/utils/user', () => ({ getCurrentUser: () => mockUser() }))
jest.mock('@/db/db', () => ({
  getDb: () => ({ execute: mockExecute, transaction: (fn: any) => fn({ execute: mockExecute }) }),
}))
const id = '11111111-1111-4111-8111-111111111111'
const ctx = { params: Promise.resolve({ id }) }
describe('feedback permissions and image validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUser.mockResolvedValue({
      userId: 2,
      userEmail: 'member@test.invalid',
      isAdmin: false,
      displayName: 'Member',
    })
  })
  it('rejects an unauthenticated read before touching the database', async () => {
    mockUser.mockResolvedValue({ userId: 0, userEmail: '', isAdmin: false })
    expect((await GET(new Request('https://test.invalid'), ctx)).status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })
  it('does not expose another member ticket or attachment', async () => {
    mockExecute.mockResolvedValue([
      { id, user_id: 3, status: 'open', attachments: [{ key: 'private' }] },
    ])
    expect((await GET(new Request('https://test.invalid'), ctx)).status).toBe(404)
    expect(
      (
        await attachment(new Request('https://test.invalid'), {
          params: Promise.resolve({ id, index: '0' }),
        })
      ).status
    ).toBe(404)
  })
  it('allows the ticket owner to read its history', async () => {
    mockExecute
      .mockResolvedValueOnce([{ id, user_id: 2, status: 'open', attachments: [] }])
      .mockResolvedValueOnce([])
    expect((await GET(new Request('https://test.invalid'), ctx)).status).toBe(200)
  })
  it('rejects member attempts to close a ticket', async () => {
    expect(
      (
        await PATCH(
          new Request('https://test.invalid', {
            method: 'PATCH',
            body: JSON.stringify({ status: 'closed' }),
          }),
          ctx
        )
      ).status
    ).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })
  it('does not accept replies to a closed ticket', async () => {
    mockExecute.mockResolvedValue([{ id, user_id: 2, status: 'closed' }])
    expect(
      (
        await POST(
          new Request('https://test.invalid', {
            method: 'POST',
            body: JSON.stringify({ content: 'extra info' }),
          }),
          ctx
        )
      ).status
    ).toBe(409)
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })
  it('allows admins to close tickets and writes an audit reply', async () => {
    mockUser.mockResolvedValue({
      userId: 1,
      userEmail: 'admin@test.invalid',
      isAdmin: true,
      displayName: 'Admin',
    })
    mockExecute.mockResolvedValueOnce([{ id, user_id: 2, status: 'open' }]).mockResolvedValue([])
    expect(
      (
        await PATCH(
          new Request('https://test.invalid', {
            method: 'PATCH',
            body: JSON.stringify({ status: 'closed' }),
          }),
          ctx
        )
      ).status
    ).toBe(200)
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })
  it('rejects disguised videos and SVG rather than trusting extensions', () => {
    expect(() => imageType(Buffer.from('<svg>fake.png</svg>'))).toThrow('不支持视频')
    expect(() => imageType(Buffer.from('....ftypmp42'))).toThrow()
    expect(imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png')
  })
})
