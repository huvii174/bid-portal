import { getDb, getPool } from '@bid/db'
import { loadRootEnv } from '../env'
import { runRefresh } from '../jobs/refresh-listings'

loadRootEnv()
const { closed, refreshed } = await runRefresh(getDb())
console.log(`closed ${closed} expired listing(s) · refreshed ${refreshed} watched listing(s)`)
await getPool().end()
