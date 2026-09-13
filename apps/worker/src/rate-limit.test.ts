import { describe, expect, it } from 'vitest'
import { createPacer } from './rate-limit'

describe('createPacer', () => {
  it('keeps two consecutive requests at least the interval apart', async () => {
    const pace = createPacer(120, 0)
    const t0 = Date.now()
    await pace()
    await pace()
    expect(Date.now() - t0).toBeGreaterThanOrEqual(115)
  })

  it('the first request is not delayed', async () => {
    const pace = createPacer(5000, 0)
    const t0 = Date.now()
    await pace()
    expect(Date.now() - t0).toBeLessThan(50)
  })

  it('adds jitter so the rhythm is not machine-regular', async () => {
    const pace = createPacer(60, 1)
    const t0 = Date.now()
    await pace()
    await pace()
    const elapsed = Date.now() - t0
    expect(elapsed).toBeGreaterThanOrEqual(55)
    expect(elapsed).toBeLessThan(60 + 60 + 60)
  })
})
