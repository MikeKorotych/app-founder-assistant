"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Run, RunInput } from "@hahaton/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@hahaton/ui";

const REGIONS = [
  { value: "UA", label: "Ukraine" },
  { value: "US", label: "United States" },
  { value: "EU", label: "European Union" },
  { value: "Global", label: "Global" },
];

type Status = { kind: "idle" } | { kind: "submitting" } | { kind: "error"; message: string } | { kind: "success"; runId: string };

export function IdeaForm() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [region, setRegion] = useState("UA");
  const [budget, setBudget] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (idea.trim().length === 0) {
      setStatus({ kind: "error", message: "Describe your idea in one sentence." });
      return;
    }

    setStatus({ kind: "submitting" });
    const body: RunInput = {
      idea: idea.trim(),
      region: region || undefined,
      budget: budget.trim() || undefined,
    };

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Request failed (${res.status})`);
      }
      const run = (await res.json()) as Run;
      setStatus({ kind: "success", runId: run.id });
      router.push(`/runs/${run.id}`);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const submitting = status.kind === "submitting";

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <CardHeader>
        <CardTitle>Describe your idea</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="idea">Idea</Label>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. An AI co-pilot for indie iOS founders that drafts App Store keywords and creatives from a single product description."
              rows={4}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              required
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="region">Region</Label>
              <select
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={submitting}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="budget">Budget (optional)</Label>
              <Input
                id="budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="$10k seed, 6-mo runway, bootstrapped…"
                disabled={submitting}
              />
            </div>
          </div>

          {status.kind === "error" && (
            <p className="text-sm text-destructive" role="alert">
              {status.message}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Running pipeline…" : "Generate plan"}
            </Button>
            {submitting && (
              <p className="text-sm text-muted-foreground">
                The agent is running 8 steps. This can take ~60–90 seconds.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
