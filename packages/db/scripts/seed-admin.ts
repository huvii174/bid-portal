import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getDb, getPool, users } from '../src/index.js'

/**
 * Tao tai khoan admin dau tien.
 *   npm run db:seed-admin -- you@example.com [matkhau]
 * Khong truyen mat khau -> sinh ngau nhien va in ra mot lan duy nhat.
 */
async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: npm run db:seed-admin -- <email> [password]')
    process.exit(1)
  }

  const password = process.argv[3] ?? randomBytes(12).toString('base64url')
  const passwordHash = await bcrypt.hash(password, 12)
  const db = getDb()

  const [row] = await db
    .insert(users)
    .values({ email, passwordHash, role: 'admin' })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role: 'admin' },
    })
    .returning({ id: users.id, email: users.email })

  console.log(`admin ready: ${row?.email}`)
  if (!process.argv[3]) console.log(`password (luu lai ngay, chi hien mot lan): ${password}`)

  await getPool().end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
