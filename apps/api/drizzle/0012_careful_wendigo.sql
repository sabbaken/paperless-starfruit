CREATE TABLE `tag_comment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag_id` integer NOT NULL,
	`comment` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_comment_tag_id_unique` ON `tag_comment` (`tag_id`);