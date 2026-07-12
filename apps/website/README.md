# @paperless-starfruit/website

The marketing landing page (`/`) and documentation (`/docs`) for Paperless
Starfruit, built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

- **Landing**: a custom Astro page at `src/pages/index.astro`.
- **Docs**: Starlight, with content under `src/content/docs/docs/` so it is
  served at `/docs/*` while the root stays the custom landing.

## Commands

```bash
pnpm --filter @paperless-starfruit/website dev        # local dev server
pnpm --filter @paperless-starfruit/website build      # static build → dist/
pnpm --filter @paperless-starfruit/website typecheck  # astro check
pnpm --filter @paperless-starfruit/website lint        # eslint
```

## Screenshots

The landing's “A look at the app” section uses real screenshots of the admin UI,
generated **manually** (not in the build or CI) and committed to
`public/screenshots/`. The generator drives the real `apps/web` UI with Playwright
but answers every API call from fixtures, so the same pages, with the same data,
come out identical every run.

```bash
# one-time: download the browser Playwright drives
pnpm --filter @paperless-starfruit/website exec playwright install chromium

# regenerate dashboard.png, review.png, prompts.png, api-keys.png
pnpm --filter @paperless-starfruit/website screenshots
```

To change what a screenshot shows (the data, or which pages), edit the fixtures
and `TARGETS` at the top of `scripts/screenshots.mjs`, re-run, and commit the PNGs.

## Deploy (Vercel)

A static Astro build (`dist/`). On Vercel, set the project **Root Directory** to
`apps/website`; Vercel auto-detects Astro and runs `astro build`. Set the
`SITE_URL` environment variable to the production origin so canonical URLs and
the sitemap are correct.
