PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`poll_interval_sec` integer DEFAULT 60 NOT NULL,
	`auto_apply` integer DEFAULT false NOT NULL,
	`create_new_tags` integer DEFAULT false NOT NULL,
	`create_new_correspondents` integer DEFAULT true NOT NULL,
	`language` text DEFAULT 'auto' NOT NULL,
	`ocr_enabled` integer DEFAULT false NOT NULL,
	`correspondent_blacklist` text DEFAULT '[]' NOT NULL,
	`llm_provider_id` integer,
	`llm_model` text,
	`ocr_provider_id` integer,
	`ocr_model` text
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "poll_interval_sec", "auto_apply", "create_new_tags", "create_new_correspondents", "language", "ocr_enabled", "correspondent_blacklist", "llm_provider_id", "llm_model", "ocr_provider_id", "ocr_model") SELECT "id", "poll_interval_sec", "auto_apply", "create_new_tags", "create_new_correspondents", "language", "ocr_enabled", "correspondent_blacklist", "llm_provider_id", "llm_model", "ocr_provider_id", "ocr_model" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;