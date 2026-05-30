"use client";

import type { Run, RunInput } from "@hahaton/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from "@hahaton/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Sample ideas for the "Suggest an idea" button — specific & demo-friendly. */
const SAMPLE_IDEAS = [
  "A subscription that delivers vet-formulated fresh dog food to pet owners in Poland.",
  "An AI co-pilot for indie iOS founders that drafts App Store keywords and creatives from a product description.",
  "A meditation app for night-shift workers that adapts sessions to irregular sleep schedules.",
  "A budgeting app for freelancers that automatically sets aside taxes from each invoice.",
  "A B2B tool that turns customer-support tickets into a prioritized product backlog.",
  "A language-learning app that teaches a language only through the lyrics of songs you like.",
  "A marketplace connecting small cafes with local bakeries for same-day pastry supply.",
  "An AI study buddy that turns lecture recordings into spaced-repetition flashcards.",
];

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; runId: string };

export function IdeaForm() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const submitting = status.kind === "submitting";

  function suggestIdea() {
    // Pick a different sample than the current one.
    const pool = SAMPLE_IDEAS.filter((s) => s !== idea.trim());
    const next = pool[Math.floor(Math.random() * pool.length)] ?? SAMPLE_IDEAS[0];
    setIdea(next);
    if (status.kind === "error") setStatus({ kind: "idle" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (idea.trim().length === 0) {
      setStatus({ kind: "error", message: "Describe your idea in one sentence." });
      return;
    }

    setStatus({ kind: "submitting" });
    const body: RunInput = { idea: idea.trim() };

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

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <CardHeader>
        <CardTitle>Describe your idea</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="idea">Idea</Label>
              <button
                type="button"
                onClick={suggestIdea}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✨ Suggest an idea
              </button>
            </div>
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

          {status.kind === "error" && (
            <p className="text-sm text-destructive" role="alert">
              {status.message}
            </p>
          )}

          <div className="flex flex-col items-center gap-2">
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
