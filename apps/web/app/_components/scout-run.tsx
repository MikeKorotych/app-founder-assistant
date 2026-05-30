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
import { PlatformPie } from "./platform-pie";
import { ReportBody } from "./report-body";
import { ScoutLoading } from "./scout-loading";

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
  iconUrl: string | null;
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
            <ScoutLoading
              title="Розбираємо ідею…"
              hint="Виділяємо ключові слова та категорії для пошуку конкурентів."
            />
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
        <ScoutLoading
          title="Scout шукає конкурентів…"
          hint="Сканую iTunes, Google Play, Product Hunt та AlternativeTo за цими запитами."
        />
      )}

      {phase.kind === "done" && (
        <div className="animate-enter">
          <CompetitorList competitors={phase.competitors} />
        </div>
      )}

      {/* Validate step — chained automatically after Scout. */}
      {validation.kind === "running" && (
        <ScoutLoading
          title="Валідуємо ідею…"
          hint="Multi-LLM панель оцінює ідею: Скептик · Адвокат · Аналітик."
        />
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

// Human labels for the four Scout sources (the row's `source` is the SourceId).
const SOURCE_LABELS: Record<string, string> = {
  itunes: "iTunes / App Store",
  googleplay: "Google Play",
  producthunt: "Product Hunt",
  alternativeto: "AlternativeTo",
};
// Display order: known sources in this order, then any unknown ones alphabetically.
const SOURCE_ORDER = ["itunes", "googleplay", "producthunt", "alternativeto"];

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

// Bucket competitors by the source they were discovered from, preserving the
// incoming compatibility-desc order within each bucket.
function groupBySource(competitors: Competitor[]): [string, Competitor[]][] {
  const groups = new Map<string, Competitor[]>();
  for (const c of competitors) {
    const list = groups.get(c.source);
    if (list) list.push(c);
    else groups.set(c.source, [c]);
  }
  const rank = (s: string) => {
    const i = SOURCE_ORDER.indexOf(s);
    return i === -1 ? SOURCE_ORDER.length : i;
  };
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  if (competitors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Конкурентів не знайдено для цих запитів. Спробуйте конкретнішу ідею.
      </p>
    );
  }
  const groups = groupBySource(competitors);
  return (
    <div className="stagger-enter flex flex-col gap-5">
      <PlatformPie sources={competitors.map((c) => c.source)} />
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Конкуренти · {competitors.length}
      </p>
      {groups.map(([source, items]) => (
        <SourceTable key={source} source={source} items={items} />
      ))}
    </div>
  );
}

// One table per data source. The scroll area is capped to ~10 rows tall; beyond
// that the body scrolls vertically while the header stays pinned.
function SourceTable({ source, items }: { source: string; items: Competitor[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{sourceLabel(source)}</p>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div className="overflow-hidden rounded-md border border-border/60">
        <div className="max-h-[34rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/95 text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Конкурент</th>
                <th className="w-24 px-3 py-2 text-center font-medium">Сумісність</th>
                <th className="px-3 py-2 text-left font-medium">Чому конкурент</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-border/60 align-top">
                  <td className="px-3 py-2.5">
                    <div className="flex items-start gap-2.5">
                      {c.iconUrl && (
                        // biome-ignore lint/performance/noImgElement: external store CDN icon, not a Next-optimizable asset
                        <img
                          src={c.iconUrl}
                          alt=""
                          loading="lazy"
                          className="mt-0.5 h-7 w-7 shrink-0 rounded-md border border-border/60 object-cover"
                        />
                      )}
                      <div className="flex min-w-0 flex-col gap-0.5">
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
                      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {c.developer && <span>{c.developer}</span>}
                        <span>{c.rating > 0 ? `★ ${c.rating.toFixed(1)}` : "★ N/A"}</span>
                        <span>
                          {c.reviewCount > 0
                            ? `${c.reviewCount.toLocaleString()} відгуків`
                            : "Відгуки: N/A"}
                        </span>
                        {c.price && <span>{c.price}</span>}
                      </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {typeof c.compatibilityScore === "number" ? (
                      <span className="inline-block rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums">
                        {c.compatibilityScore}/100
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    {c.rationale ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
