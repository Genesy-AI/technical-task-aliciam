import { describe, it, expect, vi } from 'vitest'
import { verifyLeadEmailsBatch, VerifiableLead } from './verifyLeadEmails'

const lead = (id: number, overrides: Partial<VerifiableLead> = {}): VerifiableLead => ({
  id,
  email: `lead${id}@example.com`,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  ...overrides,
})

describe('verifyLeadEmailsBatch', () => {
  it('returns aggregated results when every workflow succeeds', async () => {
    const leads = [lead(1), lead(2), lead(3)]
    const runVerifyEmailWorkflow = vi.fn(async (l: VerifiableLead) => l.id !== 2)
    const persistVerification = vi.fn(async () => undefined)

    const out = await verifyLeadEmailsBatch(leads, { runVerifyEmailWorkflow, persistVerification })

    expect(out.verifiedCount).toBe(3)
    expect(out.errors).toEqual([])
    expect(out.results).toEqual([
      { leadId: 1, emailVerified: true },
      { leadId: 2, emailVerified: false },
      { leadId: 3, emailVerified: true },
    ])
    expect(persistVerification).toHaveBeenCalledTimes(3)
    expect(persistVerification).toHaveBeenCalledWith(1, true)
    expect(persistVerification).toHaveBeenCalledWith(2, false)
    expect(persistVerification).toHaveBeenCalledWith(3, true)
  })

  it('records a per-lead error without dropping the other results (partial success)', async () => {
    const leads = [lead(1), lead(2, { firstName: 'Broken', lastName: 'Lead' }), lead(3)]
    const runVerifyEmailWorkflow = vi.fn(async (l: VerifiableLead) => {
      if (l.id === 2) throw new Error('workflow timed out after retries')
      return true
    })
    const persistVerification = vi.fn(async () => undefined)

    const out = await verifyLeadEmailsBatch(leads, { runVerifyEmailWorkflow, persistVerification })

    expect(out.verifiedCount).toBe(2)
    expect(out.results.map((r) => r.leadId)).toEqual([1, 3])
    expect(out.errors).toEqual([
      { leadId: 2, leadName: 'Broken Lead', error: 'workflow timed out after retries' },
    ])
    expect(persistVerification).toHaveBeenCalledTimes(2)
    expect(persistVerification).not.toHaveBeenCalledWith(2, expect.anything())
  })

  it('does not let one slow lead block the others (runs in parallel)', async () => {
    vi.useFakeTimers()
    try {
      const leads = [lead(1), lead(2), lead(3)]
      const settledOrder: number[] = []

      const runVerifyEmailWorkflow = vi.fn(async (l: VerifiableLead) => {
        const delay = l.id === 1 ? 5000 : 100
        await new Promise<void>((resolve) => setTimeout(resolve, delay))
        settledOrder.push(l.id)
        return true
      })
      const persistVerification = vi.fn(async () => undefined)

      const pending = verifyLeadEmailsBatch(leads, { runVerifyEmailWorkflow, persistVerification })

      await vi.advanceTimersByTimeAsync(5000)
      const out = await pending

      expect(settledOrder).toEqual([2, 3, 1])
      expect(out.verifiedCount).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('handles an empty input list', async () => {
    const out = await verifyLeadEmailsBatch([], {
      runVerifyEmailWorkflow: vi.fn(),
      persistVerification: vi.fn(),
    })
    expect(out).toEqual({ verifiedCount: 0, results: [], errors: [] })
  })

  it('reports a non-Error rejection as "Unknown error"', async () => {
    const leads = [lead(1)]
    const out = await verifyLeadEmailsBatch(leads, {
      runVerifyEmailWorkflow: async () => {
        throw 'boom'
      },
      persistVerification: vi.fn(),
    })
    expect(out.errors).toEqual([{ leadId: 1, leadName: 'First1 Last1', error: 'Unknown error' }])
    expect(out.verifiedCount).toBe(0)
  })

  it('treats a Prisma update failure as a per-lead error', async () => {
    const leads = [lead(1), lead(2)]
    const runVerifyEmailWorkflow = vi.fn(async () => true)
    const persistVerification = vi.fn(async (id: number) => {
      if (id === 2) throw new Error('db locked')
    })

    const out = await verifyLeadEmailsBatch(leads, { runVerifyEmailWorkflow, persistVerification })

    expect(out.results).toEqual([{ leadId: 1, emailVerified: true }])
    expect(out.errors).toEqual([{ leadId: 2, leadName: 'First2 Last2', error: 'db locked' }])
  })
})