CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_document_idx` ON `audit_log` (`document_id`);--> statement-breakpoint
CREATE INDEX `audit_decision_idx` ON `audit_log` (`decision`);