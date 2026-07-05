/**
 * Generate the landing-page screenshots.
 *
 *   pnpm --filter @paperless-starfruit/website screenshots
 *
 * What it does, deterministically, every run:
 *   1. starts the apps/web Vite dev server on a dedicated port,
 *   2. opens it in Playwright with a fake auth token + light theme,
 *   3. answers every `/api/**` call with the fixtures below (no real backend,
 *      no paperless — so the data, and therefore the screenshots, are identical
 *      every time),
 *   4. screenshots Dashboard, Review (the side-by-side detail), Prompts and
 *      API keys into apps/website/public/screenshots/.
 *
 * This is a MANUAL tool — it is not wired into the build or CI. Run it when the
 * UI changes, eyeball the output, and commit the PNGs. To change what's shown,
 * edit the FIXTURES below (they mirror the app's real API response shapes).
 *
 * One-time setup (downloads the browser):
 *   pnpm --filter @paperless-starfruit/website exec playwright install chromium
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const outDir = resolve(__dirname, '../public/screenshots');

const PORT = 5178; // dedicated, so it never clashes with a running `pnpm dev`
const BASE = `http://localhost:${PORT}`;
const TOKEN_KEY = 'paperless-starfruit.token';

// ---------------------------------------------------------------------------
// FIXTURES — mirror the real API response shapes (see apps/web/src/api + the
// shared package). Edit these to change what the screenshots show.
// ---------------------------------------------------------------------------
const authStatus = { initialized: true, authenticated: true };

const connection = { connected: true, baseUrl: 'https://paperless.home.lan', apiVersion: 5 };

const stats = {
  queue: { queued: 2, running: 1, done: 184, failed: 1 },
  pendingReview: 2,
  tokenSpend: 84120,
  throughput: 23,
  errorRate: 1 / 185,
  recentJobs: [
    { id: 1042, documentId: 1042, status: 'done', cost: 1204, error: null },
    { id: 1041, documentId: 1041, status: 'running', cost: null, error: null },
    { id: 1040, documentId: 1040, status: 'queued', cost: null, error: null },
    { id: 1039, documentId: 1039, status: 'done', cost: 980, error: null },
    {
      id: 1037,
      documentId: 1037,
      status: 'failed',
      cost: null,
      error: 'Provider timed out after 60s',
    },
  ],
};

// Shared between the review list and the review detail.
const reviewSuggestion = {
  title: 'Electricity invoice — March 2026',
  tags: [
    { id: 7, name: 'utilities', isNew: false },
    { id: null, name: 'invoice', isNew: true },
    { id: 12, name: '2026', isNew: false },
  ],
  correspondent: { id: 3, name: 'Vattenfall', isNew: false },
  date: '2026-03-14',
  current: {
    title: 'Scan_20260314.pdf',
    tagNames: ['unsorted'],
    correspondentName: null,
    date: null,
  },
};

const reviewList = [
  {
    id: 1,
    documentId: 1042,
    status: 'pending',
    createdAt: 1772150400,
    suggestions: reviewSuggestion,
  },
  {
    id: 2,
    documentId: 1043,
    status: 'pending',
    createdAt: 1772060400,
    suggestions: {
      title: 'Rental agreement — Storgatan 4',
      tags: [
        { id: 21, name: 'housing', isNew: false },
        { id: null, name: 'contract', isNew: true },
      ],
      correspondent: { id: 9, name: 'HSB Stockholm', isNew: false },
      date: '2026-02-28',
      current: { title: 'doc_2026_0228.pdf', tagNames: [], correspondentName: null, date: null },
    },
  },
];

const reviewDetail = {
  id: 1,
  documentId: 1042,
  status: 'pending',
  documentContent: `VATTENFALL AB
Kundservice · org.nr 556036-2138

Invoice no.  55-2026-0314
Customer     A. Andersson
Facility     Storgatan 4, 114 51 Stockholm

Billing period   1–31 March 2026
Meter 7C·091     412 kWh
Network charge   189.00 kr
Energy           453.10 kr
VAT (25%)        160.53 kr
--------------------------------
Amount due       642.10 kr
Due date         2026-04-02`,
  suggestions: reviewSuggestion,
};

const prompts = [
  {
    key: 'extraction',
    label: 'Metadata extraction',
    description:
      'Asks the model for the title, tags, correspondent and date. The response shape is enforced separately, so this prompt is about guidance and which context to include.',
    customized: false,
    body: `You extract structured metadata from a single archived document for a paperless-ngx system.
Return concise, human-meaningful values:
- title: a short descriptive title — no file extensions, no reference numbers as the whole title.
- tags: a few relevant topical tags. Strongly prefer reusing an existing tag listed below when it fits. {{tag_policy}}
- correspondent: the organisation or person the document is from (issuer/sender), or null if not evident. Prefer an existing correspondent when it matches. {{correspondent_policy}}
- date: the document's own date (when it was issued or written) as YYYY-MM-DD, or null if not evident. Never use today's date as a fallback.

Write all output in {{language}} (use the document's own language when this is "auto").

Existing tags: {{all_tags}}
Existing correspondents: {{all_correspondents}}

--- DOCUMENT CONTENT ---
{{content}}`,
    variables: [
      {
        name: 'content',
        label: 'Document text',
        description: 'The recognised text (OCR output, or paperless’s existing text).',
      },
      {
        name: 'language',
        label: 'Language',
        description: 'The configured output language, or “auto”.',
      },
      {
        name: 'all_tags',
        label: 'Existing tags',
        description: 'Every tag already in paperless — encourages reuse over invention.',
      },
      {
        name: 'all_correspondents',
        label: 'Existing correspondents',
        description: 'Every correspondent already in paperless.',
      },
      {
        name: 'tag_policy',
        label: 'Tag policy',
        description: 'Whether the model may introduce new tags.',
      },
      {
        name: 'correspondent_policy',
        label: 'Correspondent policy',
        description: 'Whether the model may introduce a new correspondent.',
      },
      {
        name: 'title',
        label: 'Current title',
        description: 'The document’s current title in paperless.',
      },
      { name: 'tags', label: 'Current tags', description: 'The document’s current tag names.' },
      {
        name: 'correspondent',
        label: 'Current correspondent',
        description: 'The document’s current correspondent, if any.',
      },
      {
        name: 'created',
        label: 'Current date',
        description: 'The document’s current date (YYYY-MM-DD).',
      },
      { name: 'filename', label: 'File name', description: 'The document’s original file name.' },
    ],
  },
  {
    key: 'ocr',
    label: 'OCR transcription',
    description:
      'Instructions for the vision model that reads a document’s original file into text. Used when OCR is enabled and the OCR model is a vision LLM.',
    customized: false,
    body: `You are a precise OCR engine. Transcribe the attached document exactly as written.
Output ONLY the document text — no preamble, no commentary, no code fences.
Preserve the reading order, line breaks and structure. Render tables as simple Markdown tables.
Do not translate, summarise, correct spelling, or invent content. Mark an unreadable run as [illegible].
Document language hint: {{language}}.`,
    variables: [
      {
        name: 'language',
        label: 'Language',
        description: 'The configured output language, or “auto”.',
      },
      { name: 'filename', label: 'File name', description: 'The document’s original file name.' },
    ],
  },
];
// `default` mirrors `body` for a fresh install (no override saved yet).
for (const p of prompts) p.default = p.body;

const testDocuments = [
  { id: 1042, title: 'Electricity invoice — March 2026' },
  { id: 1043, title: 'Rental agreement — Storgatan 4' },
  { id: 1031, title: 'Bank statement — February 2026' },
];

const providers = [
  { id: 1, name: 'Anthropic', kind: 'anthropic', baseUrl: null },
  { id: 2, name: 'OpenAI', kind: 'openai', baseUrl: null },
  {
    id: 3,
    name: 'Ollama (home server)',
    kind: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
  },
];

// The Tags page: paperless tags merged with their local AI hints (TagView[]).
const tags = [
  {
    id: 21,
    name: 'housing',
    color: '#fdbf6f',
    documentCount: 23,
    comment: 'Rent, mortgage and everything about the apartment.',
    isTrigger: false,
  },
  {
    id: 12,
    name: 'insurance',
    color: '#b2df8a',
    documentCount: 17,
    comment:
      'Anything from an insurance company: policies, claims, renewal letters. Not marketing.',
    isTrigger: false,
  },
  { id: 9, name: 'invoice', color: '#cab2d6', documentCount: 58, comment: null, isTrigger: false },
  {
    id: 4,
    name: 'psf-process',
    color: '#EBC625',
    documentCount: 3,
    comment: null,
    isTrigger: true,
  },
  {
    id: 30,
    name: 'receipts',
    color: '#8dd3c7',
    documentCount: 96,
    comment: null,
    isTrigger: false,
  },
  {
    id: 14,
    name: 'tax',
    color: '#fb9a99',
    documentCount: 12,
    comment: 'Documents from or for the tax office.',
    isTrigger: false,
  },
  {
    id: 7,
    name: 'utilities',
    color: '#a6cee3',
    documentCount: 42,
    comment: 'Electricity, water, heating and internet bills.',
    isTrigger: false,
  },
];

const version = { current: '1.3.0', updateAvailable: false, latest: '1.3.0', releaseUrl: null };

const settings = {
  pollIntervalSec: 60,
  autoApply: false,
  createNewTags: true,
  createNewCorrespondents: true,
  extractionEnabled: true,
  extractMaxPages: 100,
  language: 'auto',
  ocrEnabled: true,
  ocrMaxPages: 20,
  correspondentBlacklist: [],
  llmProviderId: 1,
  llmModel: 'claude-opus-4-5',
  ocrProviderId: 3,
  ocrModel: 'mistral-ocr-latest',
};

/** Map an `/api`-relative path + method to its fixture (null = unhandled). */
function fixtureFor(apiPath) {
  if (apiPath === '/auth/status') return authStatus;
  if (apiPath === '/connection') return connection;
  if (apiPath === '/stats') return stats;
  if (apiPath === '/prompts') return prompts;
  if (apiPath === '/prompts/documents') return testDocuments;
  if (apiPath === '/providers') return providers;
  if (apiPath === '/settings') return settings;
  if (apiPath === '/tags') return tags;
  if (apiPath === '/version') return version;
  if (/^\/review\/\d+$/.test(apiPath)) return reviewDetail;
  if (apiPath === '/review') return reviewList;
  return null;
}

// ---------------------------------------------------------------------------
// The pages to capture. `prep` runs after navigation, before the screenshot.
// ---------------------------------------------------------------------------
const TARGETS = [
  {
    name: 'dashboard',
    path: '/dashboard',
    prep: async (page) => page.getByText('Recent activity').waitFor({ timeout: 15000 }),
  },
  {
    name: 'review',
    path: '/review',
    // Open the first item to capture the side-by-side review detail.
    prep: async (page) => {
      const review = page.getByRole('button', { name: 'Review' });
      await review.first().waitFor({ timeout: 15000 });
      await review.first().click();
      await page.getByText('AI suggestions', { exact: true }).waitFor({ timeout: 15000 });
    },
  },
  {
    name: 'tags',
    path: '/tags',
    // A hinted tag row proves the table (and the AI-hint column) rendered.
    prep: async (page) => page.getByText('insurance', { exact: true }).waitFor({ timeout: 15000 }),
  },
  {
    name: 'prompts',
    path: '/settings/prompts',
    prep: async (page) => page.getByText('Variables').first().waitFor({ timeout: 15000 }),
  },
  {
    name: 'api-keys',
    path: '/settings/api-keys',
    prep: async (page) => page.getByText('Add local endpoint').waitFor({ timeout: 15000 }),
  },
];

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((res, rej) => {
    const tick = async () => {
      try {
        const r = await fetch(url);
        if (r.ok) return res();
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) return rej(new Error('web dev server did not start in time'));
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error(
      '\nPlaywright is not installed. Run:\n  pnpm --filter @paperless-starfruit/website install\n',
    );
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  console.log(`Starting web dev server on :${PORT} …`);
  const server = spawn(
    'pnpm',
    [
      '--filter',
      '@paperless-starfruit/web',
      'exec',
      'vite',
      '--port',
      String(PORT),
      '--strictPort',
    ],
    { cwd: repoRoot, detached: true, stdio: ['ignore', 'ignore', 'inherit'] },
  );

  const killServer = () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  };

  let browser;
  try {
    await waitForServer(BASE, 60000);
    console.log('Dev server is up. Launching browser …');

    try {
      browser = await chromium.launch();
    } catch (err) {
      if (/Executable doesn't exist|playwright install/i.test(String(err))) {
        console.error(
          '\nThe Chromium browser is missing. Run once:\n  pnpm --filter @paperless-starfruit/website exec playwright install chromium\n',
        );
        process.exit(1);
      }
      throw err;
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 2,
      colorScheme: 'light', // theme defaults to "system" → force light for consistency
    });
    // Authenticate before any app script runs.
    await context.addInitScript((key) => localStorage.setItem(key, 'screenshot'), TOKEN_KEY);

    // Answer every API call from the fixtures; warn on anything unhandled.
    // Match only paths rooted at `/api/` — NOT a substring glob like `**/api/**`,
    // which would also swallow Vite's own modules (e.g. /src/api/auth/index.ts).
    await context.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const apiPath = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        const data = fixtureFor(apiPath);
        if (data == null) {
          console.warn(`  · unhandled ${route.request().method()} /api${apiPath} → {}`);
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(data),
        });
      },
    );

    const page = await context.newPage();
    for (const target of TARGETS) {
      console.log(`Capturing ${target.name} …`);
      await page.goto(`${BASE}${target.path}`, { waitUntil: 'domcontentloaded' });
      await target.prep(page);
      await page.waitForTimeout(450); // let layout/fonts settle
      const file = resolve(outDir, `${target.name}.png`);
      await page.screenshot({ path: file });
      console.log(`  → ${file}`);
    }

    console.log(
      `\nDone. ${TARGETS.length} screenshots written to apps/website/public/screenshots/`,
    );
  } finally {
    if (browser) await browser.close();
    killServer();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
