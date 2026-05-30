"use client";

import type {
  Competitor as AgentCompetitor,
  Run,
  SearchExpansion,
  ValidationResult,
} from "@hahaton/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@hahaton/ui";
import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../_lib/api";
import { ValidationSection } from "../runs/[id]/_components/validation-section";
import { randomMockRun } from "./mock-run";
import { ReportBody } from "./report-body";

// A persisted competitor row as returned by GET /scout/:id (Drizzle row shape).
interface Competitor {
  id: string;
  name: string;
  developer: string | null;
  description: string | null;
  url: string | null;
  source: string;
  category: string | null;
  platforms: string | null;
  price: string | null;
  rating: number;
  reviewCount: number;
  compatibilityScore: number | null;
  rationale: string | null;
}

interface ScoutStatusResponse {
  id: string;
  status: { status?: string } | string;
  competitors: Competitor[];
}

type Phase =
  | { kind: "expanding" }
  | { kind: "scanning"; expansion: SearchExpansion; scoutId: string }
  | { kind: "done"; expansion: SearchExpansion; competitors: Competitor[] }
  | { kind: "error"; message: string; expansion?: SearchExpansion };

// The Validate step runs automatically once Scout finishes — its own state so
// the competitor list stays visible while the Multi-LLM panel scores.
type Validation =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: ValidationResult }
  | { kind: "error"; message: string };

const TERMINAL_OK = new Set(["complete", "completed"]);
const TERMINAL_BAD = new Set(["errored", "terminated", "failed"]);

function statusString(s: ScoutStatusResponse["status"]): string {
  return (typeof s === "string" ? s : (s?.status ?? "")).toLowerCase();
}

// Scout's row → the agent's Competitor shape the validation panel reads
// (it uses name + positioning, and price when present).
function toAgentCompetitor(c: Competitor): AgentCompetitor {
  return {
    name: c.name,
    positioning: c.rationale ?? c.description ?? "",
    url: c.url ?? undefined,
    ...(c.price ? { pricing: { value: c.price, rationale: "Store listing price" } } : {}),
  };
}

function Chips({ items, tone }: { items: string[]; tone: "keyword" | "category" }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  const cls =
    tone === "category"
      ? "border-primary/40 bg-primary/10 text-foreground"
      : "border-border/60 bg-muted/60 text-muted-foreground";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full border px-3 py-1 text-sm ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

// Home "Generate" flow: idea → /search-intent (LLM → keywords + categories JSON)
// → /scout (spawns the competitor-discovery Workflow) → poll /scout/:id until the
// Workflow completes → render the ranked competitors, then automatically chain
// into /validate (Multi-LLM panel → /100 scorecard). On failures, a random
// ready-made mock report keeps the demo usable. All calls go browser → API
// directly (CORS open). See app/_lib/api.ts.
export function ScoutRun({ idea, onRestart }: { idea: string; onRestart?: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "expanding" });
  const [validation, setValidation] = useState<Validation>({ kind: "idle" });
  const cancelled = useRef(false);
  const mockRunRef = useRef<Run | null>(null);

  useEffect(() => {
    cancelled.current = false;

    // Poll until the Workflow reaches a terminal state; return its competitors.
    async function poll(scoutId: string): Promise<Competitor[]> {
      for (let attempt = 0; attempt < 120 && !cancelled.current; attempt++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (cancelled.current) return [];
        const res = await fetch(apiUrl(`/scout/${scoutId}`), { cache: "no-store" });
        if (!res.ok) throw new Error(`Scout status failed (${res.status})`);
        const data = (await res.json()) as ScoutStatusResponse;
        const st = statusString(data.status);
        if (cancelled.current) return [];
        if (TERMINAL_OK.has(st)) return data.competitors ?? [];
        if (TERMINAL_BAD.has(st)) {
          const found = data.competitors ?? [];
          if (found.length > 0) return found;
          throw new Error(`Scout зупинився: ${st}`);
        }
      }
      throw new Error("Scout не завершився вчасно (таймаут).");
    }

    // Step 3 — validate: idea + discovered competitors → Multi-LLM scorecard.
    async function runValidation(competitors: Competitor[]): Promise<void> {
      setValidation({ kind: "running" });
      try {
        const res = await fetch(apiUrl("/validate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idea, competitors: competitors.map(toAgentCompetitor) }),
        });
        if (!res.ok) {
          const e = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(e.error ?? `validate failed (${res.status})`);
        }
        const result = (await res.json()) as ValidationResult;
        if (cancelled.current) return;
        setValidation({ kind: "done", result });
      } catch (err) {
        if (!cancelled.current) {
          setValidation({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    let expansion: SearchExpansion | undefined;
    (async () => {
      try {
        // Step 1 — search intent: idea → keywords + categories (validated JSON).
        const siRes = await fetch(apiUrl("/search-intent"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: idea }),
        });
        if (!siRes.ok) {
          const e = (await siRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(e.error ?? `search-intent failed (${siRes.status})`);
        }
        expansion = (await siRes.json()) as SearchExpansion;
        if (cancelled.current) return;

        // Step 2 — kick off the Scout Workflow with the expansion output.
        const scoutRes = await fetch(apiUrl("/scout"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywords: expansion.keywords,
            categories: expansion.categories,
            idea,
          }),
        });
        if (!scoutRes.ok) {
          const e = (await scoutRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(e.error ?? `scout failed (${scoutRes.status})`);
        }
        const { id: scoutId } = (await scoutRes.json()) as { id: string };
        if (cancelled.current) return;

        setPhase({ kind: "scanning", expansion, scoutId });
        const competitors = await poll(scoutId);
        if (cancelled.current) return;

        setPhase({ kind: "done", expansion, competitors });

        // Step 3 — chain into validation automatically.
        await runValidation(competitors);
      } catch (err) {
        if (!cancelled.current) {
          setPhase({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
            expansion,
          });
        }
      }
    })();

    return () => {
      cancelled.current = true;
    };
  }, [idea]);

  // On any failure we fall back to a random ready-made mock report — the demo never breaks.
  if (phase.kind === "error") {
    if (!mockRunRef.current) mockRunRef.current = randomMockRun();
    const run = mockRunRef.current;
    return (
      <div className="flex flex-1 flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Звіт
            </p>
            <p className="text-sm text-muted-foreground">{run.input.idea}</p>
          </div>
          <button
            type="button"
            aria-label="Новий прогін"
            title="Новий прогін"
            onClick={() => (onRestart ? onRestart() : window.location.assign("/"))}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            ↻
          </button>
        </header>
        <ReportBody run={run} />
      </div>
    );
  }

  const expansion = "expansion" in phase ? phase.expansion : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Ідея</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-foreground/85">{idea}</p>

          {phase.kind === "expanding" && (
            <p className="text-sm text-muted-foreground">
              Розбираємо ідею на ключові слова та категорії…
            </p>
          )}

          {expansion && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Категорії · {expansion.categories.length}
                </p>
                <Chips items={expansion.categories} tone="category" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Ключові слова · {expansion.keywords.length}
                </p>
                <Chips items={expansion.keywords} tone="keyword" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {phase.kind === "scanning" && (
        <p className="text-sm text-muted-foreground">
          Scout шукає й ранжує конкурентів за цими запитами (iTunes, Google Play, Product Hunt,
          AlternativeTo)…
        </p>
      )}

      {phase.kind === "done" && (
        <div className="animate-enter">
          <CompetitorList competitors={phase.competitors} />
        </div>
      )}

      {/* Validate step — chained automatically after Scout. */}
      {validation.kind === "running" && (
        <p className="text-sm text-muted-foreground">
          Валідуємо ідею Multi-LLM панеллю (Скептик · Адвокат · Аналітик)…
        </p>
      )}

      {validation.kind === "error" && (
        <p className="text-sm text-destructive" role="alert">
          Валідація не вдалася: {validation.message}
        </p>
      )}

      {validation.kind === "done" && (
        <div className="animate-enter">
          <ValidationSection validation={validation.result} />
        </div>
      )}

      {onRestart && phase.kind === "done" && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onRestart}>
            Нова ідея
          </Button>
        </div>
      )}
    </div>
  );
}

function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  if (competitors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Конкурентів не знайдено для цих запитів. Спробуйте конкретнішу ідею.
      </p>
    );
  }
  return (
    <div className="stagger-enter flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Конкуренти · {competitors.length}
      </p>
      {competitors.map((c) => (
        <Card
          key={c.id}
          className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60"
        >
          <CardContent className="flex flex-col gap-2 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {c.name}
                  </a>
                ) : (
                  <span className="font-medium">{c.name}</span>
                )}
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {c.source}
                </span>
              </div>
              {typeof c.compatibilityScore === "number" && (
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-sm font-medium">
                  {c.compatibilityScore}/100
                </span>
              )}
            </div>
            {c.rationale && <p className="text-sm text-muted-foreground">{c.rationale}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {c.developer && <span>{c.developer}</span>}
              <span>{c.rating > 0 ? `★ ${c.rating.toFixed(1)}` : "★ N/A"}</span>
              <span>
                {c.reviewCount > 0 ? `${c.reviewCount.toLocaleString()} відгуків` : "Відгуки: N/A"}
              </span>
              {c.price && <span>{c.price}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
