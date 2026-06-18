# Paperless AI

A self-hosted, bring-your-own-keys AI companion for [paperless-ngx](https://docs.paperless-ngx.com/):
better OCR and automatic metadata (title, tags, correspondent, date), all configured from a web UI.

## Stack

- **Monorepo:** Turborepo + pnpm
- **Backend:** NestJS (HTTP API + cron poller + in-process worker), SQLite via Drizzle, self-written table queue
- **Frontend:** React + Vite + TanStack Query + Tailwind
- **AI gateway:** Vercel AI SDK (structured output via Zod)

## Layout

```
apps/api      NestJS — API + poller + worker, one process
apps/web      React + Vite admin SPA
packages/shared   Zod schemas, types, constants (FE/BE contract)
```

## Development

```bash
pnpm install
pnpm db:generate    # generate the initial Drizzle migration
pnpm db:migrate     # apply migrations to ./data/app.db
pnpm dev            # run api (:3000) + web (:5173) together
```

The web dev server proxies `/api` to the API on port 3000.

## Build

```bash
pnpm build
```

## Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```
