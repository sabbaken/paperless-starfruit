# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

**Paperless Starfruit** — a self-hosted, bring-your-own-keys AI companion for paperless-ngx. It polls documents carrying a trigger tag, runs OCR (vision-LLM or Mistral OCR) and LLM metadata extraction (title, tags, correspondent, date), then either auto-applies the result via PATCH or puts it in a review queue. Single admin, single container, single SQLite file. Full design history lives in `tmp/PLAN_copy.md`.

## Commands

Turborepo + pnpm monorepo (Node ≥22). From the root:

- `pnpm build` / `pnpm dev` / `pnpm lint` / `pnpm typecheck` / `pnpm test`
- Single API test: `pnpm --filter @paperless-starfruit/api test src/taxonomy/tags.spec.ts` (vitest)
- DB migrations: `pnpm db:generate` / `pnpm db:migrate` (drizzle-kit, in apps/api)
- Local paperless-ngx for dev: `pnpm paperless:up` / `paperless:down` / `paperless:logs` / `paperless:token`

Gotchas:

- `packages/shared` must be built (`pnpm --filter @paperless-starfruit/shared build`) before api/web typecheck sees fresh types — stale `shared/dist` causes phantom type errors.
- The `CI` workflow (`.github/workflows/ci.yml`) runs `typecheck → lint → test → build` on every push/PR and should be green. (It was red for a long time on two now-fixed issues: web lint failed because `eslint-plugin-react-hooks` was referenced by a disable directive but never registered, and `provider.service.spec.ts` "discovers a local endpoint's models live" drained a shared stubbed `Response`.)

## Architecture

- `apps/api` — NestJS, **one process, three roles**: REST API, cron poller (`poller/`), in-process worker (`pipeline/worker.service.ts`). The `job` SQLite table _is_ the queue (`queue/`) — atomic claim via single UPDATE, plain retry counter, partial unique index = one active job per document. No broker, concurrency fixed at 1 by design.
- `apps/api/src/pipeline` — per-document flow: fetch → page-cap gates → OCR (write-back to `content`) → content-hash skip check (hash of extraction text + config fingerprint, incl. visual mode) → taxonomy context → single `generateObject` extraction with the original attached as a file/image part (whole ≤ `ocrMaxPages`, first+last pages above — `attachment.ts`, pdf-lib; Anthropic `cacheControl` on the doc block only when OCR and extraction share provider+model — caches are model-scoped, an unread write costs 1.25×) → reconcile ids → apply-or-review → audit.
- `apps/api/src/providers` — Vercel AI SDK is the provider abstraction (OpenAI-compat, Anthropic, Google, Mistral); structured output via Zod schema + one repair retry.
- `apps/api/src/paperless` — typed paperless-ngx client. Key invariant: PATCH replaces the whole `tags` array — always merge, and dropping the trigger tag on success is the reprocess-loop guard.
- `apps/web` — React + Vite admin SPA (TanStack Query polling, react-hook-form + Zod). `ui/` is mostly hand-rolled shadcn-style components. Prefer chrome-free `PageSection` over `Card` for page/settings sections.
- `apps/website` — Astro + Starlight landing (`/`) + docs (`/docs`); static, deployed to Vercel. Excluded from the Docker build.
- `packages/shared` — the only shared package: Zod schemas are the single contract for LLM output shape, config, and FE/BE DTOs. Prompt defaults + variable registry live in `src/prompts.ts` (defaults in code; DB stores only overrides, reset = DELETE).
- Auth: single admin, first-run setup in the UI, HS256 token derived from `ENCRYPTION_KEY`; API keys AES-GCM encrypted at rest. SSRF via user-supplied base URLs is intentionally accepted (admin-only, must reach local services).

## Repo conventions

- Never add AI/Codex attribution to commits, and never commit AGENTS.md or plan files (this file is gitignored on purpose).
- Releases: **pushing a `v*` tag is the whole process** — `api-publish.yml` (trigger: `push: tags: ['v*']`) creates the GitHub release from the tag with generated notes if it doesn't exist, builds the image from the tagged commit, tags it `<version>` + `latest` (`latest` skipped for prereleases — a `-suffix` in the tag marks one), bakes the version in via the `APP_VERSION` build-arg, and appends the pull command to the release notes. `gh release create vX.Y.Z` converges on the same path (it pushes the tag; the create step then no-ops). Do **not** re-add a `release: published` trigger: releases created by a workflow's `GITHUB_TOKEN` emit no event that starts other workflows, and two triggers race two identical builds when `gh release create` is used. The opt-in update check reads GitHub's `releases/latest` API (override: `UPDATE_CHECK_URL`); the root `package.json` version is only a dev fallback.

## Making a release

When asked to "make a release" («сделай релиз»), do this via `gh` (authed as `sabbaken`):

1. Everything to ship must be merged to master first; the tag targets master.
2. Pick the version: `gh release list --limit 1` for the latest tag (it can be ahead of the root `package.json`), then semver-bump by what changed since (`git log <last-tag>..master --oneline`) — patch for fixes, minor for features. The user may also name the version explicitly.
3. Tag and push: `git tag -a vX.Y.Z -m 'vX.Y.Z' && git push --follow-tags`. The workflow creates the release itself. (`gh release create vX.Y.Z --target master --generate-notes` is equivalent; for a prerelease either add `--prerelease` or use a `-suffix` tag, which the workflow detects.) `push.followTags` is set to true in this clone, so a plain `git push` carries an annotated tag on the pushed commit.
4. Watch the publish run (`gh run list --workflow=api-publish.yml`, `gh run watch <id>`) and report the result — the image lands at `ghcr.io/sabbaken/paperless-starfruit/api:X.Y.Z`.

To rebuild an existing version's image (e.g. base-image fix): `gh workflow run api-publish.yml -f tag=vX.Y.Z` (add `-f latest=true` only if it should also move `latest`).

## Pending tasks

[] No easy way to reset a password if the user forgets it after initial setup
[] Generate an encryption key automatically on the first run
