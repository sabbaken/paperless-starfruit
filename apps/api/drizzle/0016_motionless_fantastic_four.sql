ALTER TABLE `settings` ADD `attach_max_mb` integer DEFAULT 32;--> statement-breakpoint
CREATE INDEX `review_item_pending_idx` ON `review_item` (`document_id`,`status`);