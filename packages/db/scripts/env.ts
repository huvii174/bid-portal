import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/** Monorepo dung MOT .env o goc repo. */
export function loadRootEnv(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env')
  if (existsSync(root)) process.loadEnvFile(root)
}
