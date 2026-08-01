# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
# Fallback toolchain: better-sqlite3 may have no prebuilt binary.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
# api + web only (shared comes via turbo's `^build`). apps/website ships to
# Vercel; its package.json isn't copied, so astro is missing and it can't build.
RUN pnpm exec turbo run build \
  --filter=@paperless-starfruit/api \
  --filter=@paperless-starfruit/web
# Not served here, and `COPY /app` below would carry the sources into the image.
RUN rm -rf apps/website
# Drop the dev toolchain: unused at runtime, but scanners flag its CVEs.
# Both commands needed — `install --prod` strips only the root's devDeps, and
# `prune --prod` empties each importer's node_modules, which install relinks.
# Neither reinstalls better-sqlite3, so its compiled binding survives.
#   --ignore-scripts: root `prepare` runs husky, already pruned by then.
#   confirmModulesPurge=false: pnpm otherwise prompts and hangs (no tty).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm prune --prod --ignore-scripts --config.confirmModulesPurge=false \
  && pnpm install --frozen-lockfile --prod --ignore-scripts --config.confirmModulesPurge=false

FROM base AS runtime
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/app.db
# Stamped by CI from the release tag. Empty locally: falls back to package.json.
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
COPY --from=build /app /app
EXPOSE 3000
VOLUME ["/data"]
# Health lives under the global 'api' prefix; node:22 has fetch, so no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Single API + poller + worker process. DbModule migrates on boot, so no
# separate migrate step.
CMD ["node", "apps/api/dist/main.js"]
