import { eq } from 'drizzle-orm'
import { getDb, users } from '@bid/db'
import { DEFAULT_LOCALE, isLocale, type Locale } from '../i18n'

export async function getUserLocale(userId: string): Promise<Locale> {
  const [row] = await getDb()
    .select({ locale: users.locale })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return isLocale(row?.locale) ? row.locale : DEFAULT_LOCALE
}
