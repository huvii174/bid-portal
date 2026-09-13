import { getDb, getPool } from '@bid/db'
import { loadRootEnv } from '../env'
import { refreshFxRates } from '../jobs/fx'

loadRootEnv()
console.log(`saved ${await refreshFxRates(getDb())} FX rate(s)`)
await getPool().end()
