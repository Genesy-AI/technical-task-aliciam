import { describe, it, expect, vi, beforeEach } from 'vitest'

const proxyActivitiesMock = vi.fn()

vi.mock('@temporalio/workflow', () => ({
  proxyActivities: (...args: unknown[]) => {
    proxyActivitiesMock(...args)
    return { verifyEmail: vi.fn() }
  },
}))

describe('verifyEmailWorkflow proxyActivities config', () => {
  beforeEach(() => {
    proxyActivitiesMock.mockClear()
    vi.resetModules()
  })

  it('configures a 30-second timeout and a bounded retry policy', async () => {
    await import('./workflows')

    expect(proxyActivitiesMock).toHaveBeenCalledTimes(1)
    const [options] = proxyActivitiesMock.mock.calls[0]

    expect(options).toMatchObject({
      startToCloseTimeout: '30 seconds',
      retry: {
        maximumAttempts: 3,
        initialInterval: '1s',
        maximumInterval: '10s',
        backoffCoefficient: 2,
      },
    })
  })
})