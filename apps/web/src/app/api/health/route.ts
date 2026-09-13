import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@bid/db'

/**
 * Health check for the container orchestrator. It touches the database on
 * purpose: a web process that cannot reach Postgres serves nothing useful,
 * so reporting it healthy would hide the actual outage.
 */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 })
  }
}
