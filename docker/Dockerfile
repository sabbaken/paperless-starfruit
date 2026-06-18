# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
# Toolchain for compiling better-sqlite3 if no prebuilt binary is available.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/app.db
COPY --from=build /app /app
EXPOSE 3000
VOLUME ["/data"]
# Run migrations, then start the single API+poller+worker process.
CMD ["sh", "-c", "node apps/api/node_modules/.bin/tsx apps/api/src/db/migrate.ts && node apps/api/dist/main.js"]
