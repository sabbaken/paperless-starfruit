import js from '@eslint/js';
import astro from 'eslint-plugin-astro';

// Self-contained flat config for the website. Kept separate from the repo root
// config because Astro files need the astro parser + plugin; the rest of the
// monorepo is plain TS.
export default [
  // `scripts/**` is standalone Node tooling with browser-injected callbacks
  // (mixed Node + DOM globals). It is not part of the site build, so it's not linted here.
  { ignores: ['dist/**', '.astro/**', 'node_modules/**', '*.config.*', 'scripts/**'] },
  js.configs.recommended,
  ...astro.configs.recommended,
];
