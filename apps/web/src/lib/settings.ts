import { eq } from 'drizzle-orm'
import { getDb, settings } from '@bid/db'

export async function getSetting(key: string, fallback: string): Promise<string> {
  const [row] = await getDb()
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)
  return row?.value ?? fallback
}

export function getDisplayTimezone(): Promise<string> {
  return getSetting('display_timezone', 'Asia/Ho_Chi_Minh')
}
