CREATE TABLE `document_type_comment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_type_id` integer NOT NULL,
	`comment` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_type_comment_document_type_id_unique` ON `document_type_comment` (`document_type_id`);--> statement-breakpoint
CREATE TABLE `hidden_document_type` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_type_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hidden_document_type_document_type_id_unique` ON `hidden_document_type` (`document_type_id`);--> statement-breakpoint
ALTER TABLE `settings` ADD `create_new_document_types` integer DEFAULT false NOT NULL;