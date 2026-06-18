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
cp .env.example .env   # then set ENCRYPTION_KEY (see the comment in the file)
pnpm dev               # run api (:3000) + web (:5173) together
```

Open **http://localhost:5173** — the web dev server proxies `/api` to the API on port 3000.

- **Migrations apply automatically on API boot**, so there's no separate migrate step for a normal run. `pnpm db:generate` (regenerate a migration after a schema change) and `pnpm db:migrate` (apply migrations standalone, e.g. in CI) remain available.
- `ENCRYPTION_KEY` is required to save credentials (it encrypts the paperless token at rest). The API reads `.env` from `apps/api/` or the repo root.

## Local paperless-ngx for testing

A throwaway paperless-ngx instance to develop against (SQLite + Redis, default
`admin` / `admin` login — dev only):

```bash
pnpm paperless:up       # start paperless on http://localhost:8000 (first boot ~30-60s)
pnpm paperless:token    # print an API token for the admin user
pnpm paperless:logs     # tail paperless logs
pnpm paperless:down     # stop it
```

Then in the Paperless AI onboarding screen use `http://localhost:8000` and the
token. Leave **API version** blank — it's auto-detected from the server. Drop
PDFs/images into `docker/paperless-consume/` to have paperless ingest them.

## Build

```bash
pnpm build
```

## Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```
