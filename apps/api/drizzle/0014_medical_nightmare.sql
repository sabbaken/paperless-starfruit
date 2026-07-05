CREATE TABLE `hidden_tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hidden_tag_tag_id_unique` ON `hidden_tag` (`tag_id`);