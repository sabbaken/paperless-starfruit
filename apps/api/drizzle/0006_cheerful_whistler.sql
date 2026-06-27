ALTER TABLE `settings` ADD `create_new_correspondents` integer DEFAULT true NOT NULL;--> statement-breakpoint
-- Correspondent creation used to share the single `create_new_tags` toggle. Inherit
-- that value for existing rows so the split doesn't silently start creating
-- correspondents for users who had the combined toggle off.
UPDATE `settings` SET `create_new_correspondents` = `create_new_tags`;