import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

export * from './schema'
export { schema }

let pool: pg.Pool | undefined

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL is not set')
    pool = new pg.Pool({ connectionString, max: 10 })
  }
  return pool
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined

export function getDb() {
  if (!dbInstance) dbInstance = drizzle(getPool(), { schema })
  return dbInstance
}

export type Db = ReturnType<typeof getDb>

export * from './queries'

export * from './currency'
