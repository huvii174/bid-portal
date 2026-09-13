import { describe, expect, it } from 'vitest'
import { createPacer } from './rate-limit'

describe('createPacer', () => {
  it('khong cho 2 request lien tiep sat nhau hon nguong', async () => {
    const pace = createPacer(120, 0)
    const t0 = Date.now()
    await pace()
    await pace()
    expect(Date.now() - t0).toBeGreaterThanOrEqual(115)
  })

  it('request dau tien khong bi cho', async () => {
    const pace = createPacer(5000, 0)
    const t0 = Date.now()
    await pace()
    expect(Date.now() - t0).toBeLessThan(50)
  })

  it('them nhieu ngau nhien de khong tao nhip deu tam tap', async () => {
    const pace = createPacer(60, 1)
    const t0 = Date.now()
    await pace()
    await pace()
    const elapsed = Date.now() - t0
    expect(elapsed).toBeGreaterThanOrEqual(55)
    expect(elapsed).toBeLessThan(60 + 60 + 60)
  })
})
