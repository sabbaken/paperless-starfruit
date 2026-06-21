DROP INDEX `prompt_template_key_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_template_key_unique` ON `prompt_template` (`key`);--> statement-breakpoint
ALTER TABLE `prompt_template` DROP COLUMN `version`;--> statement-breakpoint
ALTER TABLE `prompt_template` DROP COLUMN `is_active`;