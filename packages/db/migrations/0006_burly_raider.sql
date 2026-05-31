CREATE TABLE `chart_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`feed` text NOT NULL,
	`rank` integer NOT NULL,
	`captured_on` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chart_snap_app_feed` ON `chart_snapshots` (`app_id`,`feed`);