CREATE TABLE `digests` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'global' NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
