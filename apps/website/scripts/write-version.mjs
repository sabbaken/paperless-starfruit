// Generates public/version.json from the monorepo root package.json so the
// deployed site always advertises the current release. Runs before `astro build`
// (see the "build" script), so a single root version bump publishes itself.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rootPkg = JSON.parse(readFileSync(resolve(here, '../../../package.json'), 'utf8'));

const manifest = {
  version: rootPkg.version,
  releaseUrl: 'https://github.com/sabbaken/paperless-starfruit/releases',
};

const outDir = resolve(here, '../public');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'version.json');
writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`write-version: ${outFile} → v${manifest.version}`);
