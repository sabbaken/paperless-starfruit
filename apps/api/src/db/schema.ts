import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { JOB_STATUS } from '@paperless-ai/shared';

const timestamp = (name: string) =>
  integer(name, { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`);

/** Connection to the paperless-ngx instance (single row in practice). */
export const paperlessConnection = sqliteTable('paperless_connection', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  baseUrl: text('base_url').notNull(),
  tokenEncrypted: text('token_encrypted').notNull(),
  apiVersion: integer('api_version').notNull().default(9),
  createdAt: timestamp('created_at'),
});

/** A configured LLM / OCR provider. The API key is stored encrypted at rest. */
export const provider = sqliteTable('provider', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  baseUrl: text('base_url'),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  model: text('model').notNull(),
  caps: text('caps', { mode: 'json' }),
  createdAt: timestamp('created_at'),
});

/** Editable prompt templates with version history. */
export const promptTemplate = sqliteTable(
  'prompt_template',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    key: text('key').notNull(),
    body: text('body').notNull(),
    version: integer('version').notNull().default(1),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [index('prompt_template_key_idx').on(t.key)],
);

/** Single-row application settings (id = 1). */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  pollIntervalSec: integer('poll_interval_sec').notNull().default(60),
  autoApply: integer('auto_apply', { mode: 'boolean' }).notNull().default(false),
  createNewTags: integer('create_new_tags', { mode: 'boolean' })
    .notNull()
    .default(true),
  language: text('language').notNull().default('auto'),
  ocrEnabled: integer('ocr_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  correspondentBlacklist: text('correspondent_blacklist', { mode: 'json' })
    .notNull()
    .$type<string[]>()
    .default([]),
  /** FK-ish pointer to `provider.id` the pipeline extracts with; null until set. */
  defaultProviderId: integer('default_provider_id'),
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

export type Job = typeof job.$inferSelect;
export type NewJob = typeof job.$inferInsert;
export type Provider = typeof provider.$inferSelect;
export type NewProvider = typeof provider.$inferInsert;
export type SettingsRow = typeof settings.$inferSelect;
export type ReviewItem = typeof reviewItem.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
