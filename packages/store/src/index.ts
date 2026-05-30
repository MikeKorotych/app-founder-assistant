import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Run } from "@hahaton/contracts";

/**
 * Dead-simple JSON-on-disk persistence for runs. Enough for the hackathon:
 * lets a completed run reload + replay instantly on stage (the demo safety net).
 * Swap for SQLite/Postgres later if needed.
 *
 * Resolves relative to the calling process's cwd, so each app keeps its own
 * `data/runs` directory.
 */
const RUNS_DIR = join(process.cwd(), "data", "runs");

const runPath = (id: string) => join(RUNS_DIR, `${id}.json`);

export async function saveRun(run: Run): Promise<void> {
  await mkdir(RUNS_DIR, { recursive: true });
  await writeFile(runPath(run.id), JSON.stringify(run, null, 2), "utf8");
}

export async function loadRun(id: string): Promise<Run | null> {
  try {
    return JSON.parse(await readFile(runPath(id), "utf8")) as Run;
  } catch {
    return null;
  }
}
