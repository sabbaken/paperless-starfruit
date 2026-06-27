import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { JOB_STATUS } from '@paperless-starfruit/shared';

const timestamp = (name: string) =>
  integer(name, { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`);

/**
 * The single admin account. Created once via the first-run setup (no account →
 * registration is open; once one exists it's closed). Password stored as a
 * salted scrypt hash, never plaintext.
 */
export const user = sqliteTable('user', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at'),
});

/** Connection to the paperless-ngx instance (single row in practice). */
export const paperlessConnection = sqliteTable('paperless_connection', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  baseUrl: text('base_url').notNull(),
  tokenEncrypted: text('token_encrypted').notNull(),
  apiVersion: integer('api_version').notNull().default(9),
  createdAt: timestamp('created_at'),
});

/**
 * A configured provider credential (an API key, or a local OpenAI-compatible
 * endpoint). The API key is stored encrypted at rest. The model is no longer
 * bound here — it is chosen per task in settings.
 */
export const provider = sqliteTable('provider', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  baseUrl: text('base_url'),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  caps: text('caps', { mode: 'json' }),
  createdAt: timestamp('created_at'),
});

/**
 * User overrides for the built-in prompts. Only customised prompts get a row —
 * the absence of a row means "use the code default", so "Reset to default" is a
 * plain delete. One row per key (unique).
 */
export const promptTemplate = sqliteTable(
  'prompt_template',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull().unique(),
    body: text('body').notNull(),
    updatedAt: timestamp('updated_at'),
  },
);

/** Single-row application settings (id = 1). */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  pollIntervalSec: integer('poll_interval_sec').notNull().default(60),
  autoApply: integer('auto_apply', { mode: 'boolean' }).notNull().default(true),
  createNewTags: integer('create_new_tags', { mode: 'boolean' })
    .notNull()
    .default(false),
  createNewCorrespondents: integer('create_new_correspondents', { mode: 'boolean' })
    .notNull()
    .default(true),
  /** Skip extraction (and OCR) for documents with more pages than this; null = no limit. */
  extractMaxPages: integer('extract_max_pages').default(100),
  language: text('language').notNull().default('auto'),
  ocrEnabled: integer('ocr_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  /** Skip OCR (reuse paperless's text) for documents with more pages than this; null = no limit. */
  ocrMaxPages: integer('ocr_max_pages').default(20),
  correspondentBlacklist: text('correspondent_blacklist', { mode: 'json' })
    .notNull()
    .$type<string[]>()
    .default([]),
  /** The credential + model the pipeline extracts with; null until chosen. */
  llmProviderId: integer('llm_provider_id'),
  llmModel: text('llm_model'),
  /** The credential + model used for OCR (consumed in M5); null until chosen. */
  ocrProviderId: integer('ocr_provider_id'),
  ocrModel: text('ocr_model'),
});

/**
 * The queue. `content_hash` is set DURING the job (post-OCR) — a hash of the
 * extraction-input text plus the config fingerprint, never the original file.
 * The partial unique index enforces "one active job per document".
 */
export const job = sqliteTable(
  'job',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    documentId: integer('document_id').notNull(),
    contentHash: text('content_hash'),
    status: text('status').notNull().default(JOB_STATUS.QUEUED),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    cost: integer('cost'),
    error: text('error'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    uniqueIndex('job_active_per_doc')
      .on(t.documentId)
      .where(sql`status in ('queued', 'running')`),
    index('job_status_idx').on(t.status),
    index('job_completed_lookup_idx').on(t.documentId, t.contentHash),
  ],
);

/** A pending human-review item produced when auto-apply is off. */
export const reviewItem = sqliteTable('review_item', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id')
    .notNull()
    .references(() => job.id),
  documentId: integer('document_id').notNull(),
  suggestions: text('suggestions', { mode: 'json' }).notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at'),
});

/** Append-only audit trail of every processing run. */
export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id'),
  documentId: integer('document_id').notNull(),
  prompt: text('prompt'),
  rawOutput: text('raw_output'),
  result: text('result', { mode: 'json' }),
  tokensCost: integer('tokens_cost'),
  decision: text('decision'),
  createdAt: timestamp('created_at'),
});

export type User = typeof user.$inferSelect;
export type Job = typeof job.$inferSelect;
export type NewJob = typeof job.$inferInsert;
export type Provider = typeof provider.$inferSelect;
export type NewProvider = typeof provider.$inferInsert;
export type SettingsRow = typeof settings.$inferSelect;
export type ReviewItem = typeof reviewItem.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
