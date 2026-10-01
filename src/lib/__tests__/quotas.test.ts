import { quotaExceeded } from '../quotas'
jest.mock('server-only', () => ({}), { virtual: true })
const policy = { dailyLimit: 3, totalLimit: 5, concurrentLimit: 1, storageBytes: 100 }
it('supports unlimited and paused policies', () => {
  const usage = { today: 3, total: 5, active: 1, bytes: 100 }
  expect(
    quotaExceeded(
      { dailyLimit: null, totalLimit: null, concurrentLimit: null, storageBytes: null },
      usage
    )
  ).toBeNull()
  expect(
    quotaExceeded({ ...policy, dailyLimit: 0 }, { today: 0, total: 0, active: 0, bytes: 0 })
  ).toContain('今日')
})
it('rejects daily, total, concurrent and storage exhaustion', () => {
  expect(quotaExceeded(policy, { today: 3, total: 3, active: 0, bytes: 0 })).toContain('今日')
  expect(quotaExceeded(policy, { today: 0, total: 5, active: 0, bytes: 0 })).toContain('总')
  expect(quotaExceeded(policy, { today: 0, total: 0, active: 1, bytes: 0 })).toContain('同时')
  expect(quotaExceeded(policy, { today: 0, total: 0, active: 0, bytes: 90 }, 11)).toContain('存储')
  expect(quotaExceeded(policy, { today: 0, total: 0, active: 0, bytes: 90 }, 10)).toBeNull()
})
