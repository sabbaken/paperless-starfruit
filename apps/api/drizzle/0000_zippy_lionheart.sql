CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer,
	`document_id` integer NOT NULL,
	`prompt` text,
	`raw_output` text,
	`result` text,
	`tokens_cost` integer,
	`decision` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `job` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`content_hash` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`cost` integer,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_active_per_doc` ON `job` (`document_id`) WHERE status in ('queued', 'running');--> statement-breakpoint
CREATE INDEX `job_status_idx` ON `job` (`status`);--> statement-breakpoint
CREATE INDEX `job_completed_lookup_idx` ON `job` (`document_id`,`content_hash`);--> statement-breakpoint
CREATE TABLE `paperless_connection` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`base_url` text NOT NULL,
	`token_encrypted` text NOT NULL,
	`api_version` integer DEFAULT 9 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompt_template` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`body` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompt_template_key_idx` ON `prompt_template` (`key`);--> statement-breakpoint
CREATE TABLE `provider` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`base_url` text,
	`api_key_encrypted` text NOT NULL,
	`model` text NOT NULL,
	`caps` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`document_id` integer NOT NULL,
	`suggestions` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`poll_interval_sec` integer DEFAULT 60 NOT NULL,
	`auto_apply` integer DEFAULT false NOT NULL,
	`create_new_tags` integer DEFAULT true NOT NULL,
	`language` text DEFAULT 'auto' NOT NULL,
	`ocr_enabled` integer DEFAULT false NOT NULL,
	`correspondent_blacklist` text DEFAULT '[]' NOT NULL
);
