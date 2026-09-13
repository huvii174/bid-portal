import { fxRates, type Db } from '@bid/db'

const FX_URL = 'https://open.er-api.com/v6/latest/USD'

/**
 * Ty gia cong khai, khong can API key, cap nhat hang ngay. Chon nguon nay thay
 * vi ECB/frankfurter vi ECB khong cong bo VND — ma VND la thu doi can nhin.
 *
 * Khong dung ty gia nhung san trong trang cua LiveAuctioneers: ty gia cua ta
 * khong nen phu thuoc vao mot site ta dang crawl.
 */
export async function refreshFxRates(db: Db): Promise<number> {
  let res: Response
  try {
    res = await fetch(FX_URL, { signal: AbortSignal.timeout(20_000) })
  } catch (err) {
    console.warn(`[fx] khong goi duoc nguon ty gia: ${(err as Error).message}`)
    return 0
  }

  if (!res.ok) {
    console.warn(`[fx] nguon ty gia tra ve HTTP ${res.status}`)
    return 0
  }

  const body = (await res.json()) as { result?: string; rates?: Record<string, number> }
  if (body.result !== 'success' || !body.rates) {
    console.warn('[fx] phan hoi ty gia khong hop le')
    return 0
  }

  const now = new Date()
  let saved = 0

  for (const [currency, perUsd] of Object.entries(body.rates)) {
    if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(perUsd) || perUsd <= 0) continue

    await db
      .insert(fxRates)
      .values({ currency, perUsd: String(perUsd), fetchedAt: now })
      .onConflictDoUpdate({
        target: fxRates.currency,
        set: { perUsd: String(perUsd), fetchedAt: now },
      })
    saved++
  }

  return saved
}
