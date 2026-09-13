import { getDb, getPool } from '@bid/db'
import { loadRootEnv } from '../env'
import { refreshFxRates } from '../jobs/fx'

loadRootEnv()
console.log(`da luu ${await refreshFxRates(getDb())} ty gia`)
await getPool().end()
