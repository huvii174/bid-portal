import { getDb, getPool } from '@bid/db'
import { loadRootEnv } from '../env'
import { purgeOldListings } from '../jobs/retention'

loadRootEnv()
console.log(`da xoa ${await purgeOldListings(getDb())} listing qua han luu tru`)
await getPool().end()
