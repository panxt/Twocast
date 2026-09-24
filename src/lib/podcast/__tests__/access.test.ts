import { canManageTask, canReadTask } from '../access'

const owner = { userEmail: 'member-1@example.invalid', isAdmin: false, isTeamMember: true }
const teammate = { userEmail: 'member-2@example.invalid', isAdmin: false, isTeamMember: true }
const guest = { userEmail: 'guest@example.invalid', isAdmin: false, isTeamMember: false }
const admin = { userEmail: 'admin@example.invalid', isAdmin: true, isTeamMember: true }

describe('team library access', () => {
  it('keeps private episodes available only to their owner and administrators', () => {
    const task = { userEmail: owner.userEmail, visibility: 'private' as const }
    expect(canReadTask(task, owner)).toBe(true)
    expect(canReadTask(task, teammate)).toBe(false)
    expect(canReadTask(task, admin)).toBe(true)
  })

  it('lets teammates read shared episodes without granting management rights', () => {
    const task = { userEmail: owner.userEmail, visibility: 'team' as const }
    expect(canReadTask(task, teammate)).toBe(true)
    expect(canReadTask(task, guest)).toBe(false)
    expect(canReadTask({ userEmail: guest.userEmail, visibility: 'team' }, guest)).toBe(true)
    expect(canManageTask(task, teammate)).toBe(false)
    expect(canManageTask(task, owner)).toBe(true)
    expect(canManageTask(task, admin)).toBe(true)
    expect(canReadTask(task, { userEmail: '', isAdmin: false, isTeamMember: false })).toBe(false)
  })
})
