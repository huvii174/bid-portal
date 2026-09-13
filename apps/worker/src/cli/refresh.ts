import { getDb, getPool } from '@bid/db'
import { loadRootEnv } from '../env'
import { runRefresh } from '../jobs/refresh-listings'

loadRootEnv()
const { closed, refreshed } = await runRefresh(getDb())
console.log(`da dong ${closed} listing qua gio · lam moi ${refreshed} listing dang theo doi`)
await getPool().end()
