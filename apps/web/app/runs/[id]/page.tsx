import Link from "next/link";
import { notFound } from "next/navigation";
import type { Run } from "@hahaton/contracts";
import { Button } from "@hahaton/ui";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

async function fetchRun(id: string): Promise<Run | null> {
  const res = await fetch(`${API_URL}/runs/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load run ${id}: ${res.status}`);
  return (await res.json()) as Run;
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await fetchRun(id);
  if (!run) notFound();

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Run</p>
          <h1 className="font-mono text-lg">{run.id}</h1>
        </div>
        <Link href="/">
          <Button variant="outline">New run</Button>
        </Link>
      </header>

      <p className="text-sm text-muted-foreground">
        Status: <span className="font-medium text-foreground">{run.status}</span>. Report sections (C4) land here next —
        for now this page shows the raw run JSON so the pipeline can be exercised end-to-end.
      </p>

      <pre className="overflow-auto rounded-md border border-border/60 bg-card/60 p-4 text-xs leading-relaxed">
        {JSON.stringify(run, null, 2)}
      </pre>
    </main>
  );
}
