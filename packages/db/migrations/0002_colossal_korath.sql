CREATE TABLE `search_expansions` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`locale` text,
	`keywords` text NOT NULL,
	`categories` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
