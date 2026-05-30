import type { Run } from "@hahaton/contracts";
import { type Db, runs } from "@hahaton/db";
import { eq } from "drizzle-orm";

/**
 * D1-backed persistence for runs — the demo replay safety net. A completed run
 * is upserted as a single row (full JSON in `data`) so it reloads + replays
 * instantly on stage. Pass the Drizzle handle from the Worker: `createDb(c.env.DB)`.
 */
const nowIso = () => new Date().toISOString();

export async function saveRun(db: Db, run: Run): Promise<void> {
  const data = JSON.stringify(run);
  await db
    .insert(runs)
    .values({ id: run.id, status: run.status, data, updatedAt: nowIso() })
    .onConflictDoUpdate({
      target: runs.id,
      set: { status: run.status, data, updatedAt: nowIso() },
    });
}

export async function loadRun(db: Db, id: string): Promise<Run | null> {
  const [row] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  if (!row) return null;
  return JSON.parse(row.data) as Run;
}
