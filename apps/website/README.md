# @paperless-starfruit/website

The marketing landing page (`/`) and documentation (`/docs`) for Paperless
Starfruit, built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

- **Landing** — a custom Astro page at `src/pages/index.astro`.
- **Docs** — Starlight, with content under `src/content/docs/docs/` so it is
  served at `/docs/*` while the root stays the custom landing.

## Commands

```bash
pnpm --filter @paperless-starfruit/website dev        # local dev server
pnpm --filter @paperless-starfruit/website build      # static build → dist/
pnpm --filter @paperless-starfruit/website typecheck  # astro check
pnpm --filter @paperless-starfruit/website lint        # eslint
```

## Deploy (Vercel)

A static Astro build (`dist/`). On Vercel, set the project **Root Directory** to
`apps/website`; Vercel auto-detects Astro and runs `astro build`. Set the
`SITE_URL` environment variable to the production origin so canonical URLs and
the sitemap are correct.
