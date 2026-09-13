import { and, inArray, isNotNull, lt, sql } from 'drizzle-orm'
import { listings, type Db } from '@bid/db'

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? '90')

/**
 * Giu du lieu toi da 90 ngay sau khi phien ket thuc — mot trong nhung cam ket
 * giam thieu rui ro ToS trong plan, nen phai la job that chu khong phai loi hua.
 *
 * Listing dang nam trong watchlist cua ai do KHONG bi xoa: doi con can xem lai
 * gia lich su cua chinh nhung mon ho da theo doi.
 */
export async function purgeOldListings(db: Db): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600_000)

  const result = await db.delete(listings).where(
    and(
      inArray(listings.status, ['ended', 'sold', 'withdrawn', 'stale']),
      isNotNull(listings.endsAtUtc),
      lt(listings.endsAtUtc, cutoff),
      sql`not exists (select 1 from watchlist_items w where w.listing_id = ${listings.id})`,
    ),
  )

  return result.rowCount ?? 0
}
