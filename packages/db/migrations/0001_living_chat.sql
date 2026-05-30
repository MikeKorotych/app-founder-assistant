CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`name` text NOT NULL,
	`developer` text,
	`description` text,
	`url` text,
	`source` text NOT NULL,
	`category` text,
	`platforms` text,
	`price` text,
	`rating` real DEFAULT 0 NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`compatibility_score` real,
	`rationale` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
