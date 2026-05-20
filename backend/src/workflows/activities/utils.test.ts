import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyEmail } from './utils'

describe('verifyEmail activity', () => {
  it('returns false for emails matching the john.doe pattern', async () => {
    await expect(verifyEmail('john.doe@example.com')).resolves.toBe(false)
  })

  it('returns false for emails containing a "+" (subaddressed)', async () => {
    await expect(verifyEmail('alice+work@example.com')).resolves.toBe(false)
  })

  it('returns true for a normal valid-looking email', async () => {
    await expect(verifyEmail('ada.lovelace@example.com')).resolves.toBe(true)
  })

  describe('jane.smith slow path', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('eventually resolves to true after the 20s delay (within the new 30s timeout)', async () => {
      const pending = verifyEmail('jane.smith@example.com')
      await vi.advanceTimersByTimeAsync(20000)
      await expect(pending).resolves.toBe(true)
    })
  })
})