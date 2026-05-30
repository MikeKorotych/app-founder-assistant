CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
