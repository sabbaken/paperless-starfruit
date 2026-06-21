import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Resolve the shared package to its TypeScript source. The package emits
// CommonJS for the NestJS API, but Vite/rollup can't statically trace named
// exports through CJS `export *` chains — bundling the ESM source sidesteps
// that and means web dev needs no prebuild of `shared`.
const sharedSrc = fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url));
const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@paperless-starfruit/shared': sharedSrc,
      '@': srcDir,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
