-- Wipe all persisted runs on the remote D1 (used by `pnpm db:clear:remote`). Irreversible.
DELETE FROM runs;
