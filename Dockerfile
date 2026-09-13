# Multi-target build for the whole monorepo. Pick one with `--target`:
#   web      — Next.js server (standalone output)
#   worker   — crawler, job queue, scheduled maintenance
#   migrate  — one-shot drizzle migration runner
#
# Build context is the repo root so the workspace packages are visible.

# ---------------------------------------------------------------- base deps --
FROM node:24-alpine AS deps
WORKDIR /app

# Copy only manifests first so `npm ci` is cached until a dependency changes.
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN npm ci

# --------------------------------------------------------- prod-only deps --
# The worker runs no tests and no migrations, so it does not need vitest,
# drizzle-kit or the TypeScript compiler. tsx lives in its dependencies because
# the worker genuinely executes TypeScript at runtime.
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN npm ci --omit=dev

# ------------------------------------------------------------------- source --
FROM deps AS source
WORKDIR /app
COPY tsconfig.json ./
COPY packages ./packages
COPY apps ./apps

# --------------------------------------------------------------- web: build --
FROM source AS web-build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# No secrets needed here: every route reads cookies, so all of them are dynamic
# and nothing is prerendered at build time.
RUN npm run -w @bid/web build

# ----------------------------------------------------------------- web: run --
FROM node:24-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100 HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

# `output: standalone` with outputFileTracingRoot at the repo root mirrors the
# workspace layout, so server.js sits under apps/web.
COPY --from=web-build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=web-build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static

USER app
EXPOSE 3100
CMD ["node", "apps/web/server.js"]

# -------------------------------------------------------------- worker: run --
FROM node:24-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

# The worker runs TypeScript through tsx rather than a compiled bundle, so it
# ships its sources and the workspace node_modules.
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=source --chown=app:app /app/package.json ./package.json
COPY --from=source --chown=app:app /app/tsconfig.json ./tsconfig.json
COPY --from=source --chown=app:app /app/packages ./packages
COPY --from=source --chown=app:app /app/apps/worker ./apps/worker

USER app
WORKDIR /app/apps/worker
CMD ["npx", "tsx", "src/main.ts"]

# ------------------------------------------------------------- migrate: run --
FROM source AS migrate
WORKDIR /app/packages/db
# Runs to completion and exits; compose gates web and worker on that exit code.
CMD ["npx", "drizzle-kit", "migrate"]
