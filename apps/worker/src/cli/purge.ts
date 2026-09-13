import { getDb, getPool } from '@bid/db'
import { loadRootEnv } from '../env'
import { purgeOldListings } from '../jobs/retention'

loadRootEnv()
console.log(`purged ${await purgeOldListings(getDb())} listing(s) past the retention window`)
await getPool().end()
