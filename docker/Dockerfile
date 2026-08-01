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
# Only build what ships in this image: the API and the web UI it serves
# statically (shared is pulled in via turbo's `^build`). apps/website is the
# Astro landing/docs site, deployed separately to Vercel. Its package.json
# isn't copied above, so astro was never installed and building it here fails.
RUN pnpm exec turbo run build \
  --filter=@paperless-starfruit/api \
  --filter=@paperless-starfruit/web
# apps/website is the Astro landing/docs site (deployed separately to Vercel):
# never built or served here. Drop its sources so the runtime `COPY /app` below
# doesn't carry them into the image.
RUN rm -rf apps/website
# Everything that ships from here on is compiled output, so drop the dev
# toolchain (vitest, vite, esbuild, drizzle-kit, the Nest CLI). It never runs
# in the container, but it does ship to users, where image scanners report its
# CVEs against this image.
# It takes both commands. `install --prod` alone only strips the *root*
# project's devDependencies and leaves every workspace package's in place;
# `prune --prod` clears the virtual store but, with --ignore-scripts, also
# empties each importer's node_modules, so the second command relinks them.
# Neither reinstalls better-sqlite3, so its compiled binding survives.
#   --ignore-scripts: the root `prepare` runs husky, itself a devDependency,
#     so it is already gone when the lifecycle script fires.
#   confirmModulesPurge=false: otherwise pnpm asks before touching
#     node_modules, finds no tty, and hangs.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm prune --prod --ignore-scripts --config.confirmModulesPurge=false \
  && pnpm install --frozen-lockfile --prod --ignore-scripts --config.confirmModulesPurge=false

FROM base AS runtime
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/app.db
# The release version stamped by CI from the release tag: what the app reports
# as "current". Empty for local builds, which fall back to the root package.json.
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
COPY --from=build /app /app
EXPOSE 3000
VOLUME ["/data"]
# Liveness probe. The app runs under the global 'api' prefix, so health is at
# /api/health; node:22 ships a global fetch, so no curl/wget needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Start the single API + poller + worker process. Migrations are applied on boot
# by DbModule (idempotent, path-correct), so there's no separate migrate step.
CMD ["node", "apps/api/dist/main.js"]
