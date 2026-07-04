// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

// The public origin. Override at build time on Vercel with `SITE_URL` so canonical
// URLs and the sitemap point at the real deployment. Falls back to the project's
// default Vercel domain for local builds.
const site = process.env.SITE_URL ?? 'https://paperless-starfruit.vercel.app';

// https://astro.build/config
export default defineConfig({
  site,
  // A custom landing page lives at `src/pages/index.astro`; Starlight owns
  // everything under `/docs/*` (its content is nested in `src/content/docs/docs/`).
  integrations: [
    starlight({
      title: 'Paperless Starfruit',
      description:
        'A self-hosted, bring-your-own-keys AI companion for paperless-ngx: better OCR and automatic metadata, configured from a web UI.',
      logo: {
        src: './src/assets/logo.png',
        alt: 'Paperless Starfruit',
      },
      favicon: '/favicon.png',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/sabbaken/paperless-starfruit',
        },
      ],
      // Space Grotesk first so the header wordmark can match the landing nav
      // (Nav.astro) exactly; theme.css then applies the brand overrides.
      customCss: ['@fontsource-variable/space-grotesk', './src/styles/theme.css'],
      // Default social-card image for docs pages (the landing sets its own).
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: `${site}/og.png` } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: `${site}/og.png` } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
      ],
      // The custom landing owns `/`, so Starlight has no content at the site
      // root — disable its built-in 404 (a branded `src/pages/404.astro` covers it).
      disable404Route: true,
      pagination: true,
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Overview', link: '/docs/' },
            { label: 'Installation', link: '/docs/installation/' },
            { label: 'Connect paperless', link: '/docs/connect-paperless/' },
          ],
        },
        {
          label: 'Configuration',
          items: [
            { label: 'AI providers', link: '/docs/providers/' },
            { label: 'Processing', link: '/docs/processing/' },
            { label: 'Tags & AI hints', link: '/docs/tags/' },
            { label: 'Prompts', link: '/docs/prompts/' },
          ],
        },
        {
          label: 'Using it',
          items: [
            { label: 'How processing works', link: '/docs/pipeline/' },
            { label: 'The review queue', link: '/docs/review/' },
            { label: 'FAQ & troubleshooting', link: '/docs/faq/' },
          ],
        },
      ],
    }),
    sitemap(),
  ],
});
