-- Quick peek at the most recent runs on the remote D1 (used by `pnpm db:inspect:remote`).
SELECT id, status, created_at, updated_at FROM runs ORDER BY created_at DESC LIMIT 50;
