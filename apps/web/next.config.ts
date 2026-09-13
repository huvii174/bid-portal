import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { NextConfig } from 'next'

// Monorepo dung MOT .env o goc; Next chi tu doc .env trong apps/web.
const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const config: NextConfig = {
  transpilePackages: ['@bid/db'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.hibid.com' }],
  },
}

export default config
