import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { NextConfig } from 'next'

const here = dirname(fileURLToPath(import.meta.url))

// Monorepo dung MOT .env o goc. Trong Docker thi khong co file nay va bien moi
// truong den tu container, nen existsSync giu cho ca hai duong deu chay duoc.
const rootEnv = resolve(here, '../../.env')
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const config: NextConfig = {
  transpilePackages: ['@bid/db'],
  // Anh runtime chi can server.js + node_modules toi thieu thay vi ca repo.
  output: 'standalone',
  // Bat buoc trong monorepo: mac dinh Next chi truy vet tu apps/web, nen se
  // bo sot packages/db.
  outputFileTracingRoot: resolve(here, '../..'),
}

export default config
