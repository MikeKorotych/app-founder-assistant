"use client";

import type {
  Competitor as AgentCompetitor,
  CompetitorProfile,
  GlobalNicheRadar as GlobalNicheRadarResult,
  OpportunityReport,
  Run,
  SearchExpansion,
  ValidationResult,
} from "@hahaton/contracts";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiUrl } from "../_lib/api";
import { stopBackgroundMusic } from "../_lib/background-music";
import { randomMockRun } from "./mock-run";

// A persisted competitor row as returned by GET /scout/:id (Drizzle row shape).
export interface Competitor {
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
  launchedAt: string | null;
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

export type Phase =
  | { kind: "expanding" }
  | { kind: "scanning"; expansion: SearchExpansion; scoutId: string }
  | { kind: "done"; expansion: SearchExpansion; competitors: Competitor[] }
  | { kind: "error"; message: string; expansion?: SearchExpansion };

export type Validation =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: ValidationResult }
  | { kind: "error"; message: string };

export type Opportunity =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; report: OpportunityReport; profiles: CompetitorProfile[] }
  | { kind: "error"; message: string };

export type GlobalRadar =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; radar: GlobalNicheRadarResult }
  | { kind: "error"; message: string };

export type ViewMode = "real" | "mock";

const TERMINAL_OK = new Set(["complete", "completed"]);
const TERMINAL_BAD = new Set(["errored", "terminated", "failed"]);

function statusString(s: ScoutStatusResponse["status"]): string {
  return (typeof s === "string" ? s : (s?.status ?? "")).toLowerCase();
}

// Scout's row → the agent's Competitor shape the validation panel reads.
function toAgentCompetitor(c: Competitor): AgentCompetitor {
  return {
    name: c.name,
    positioning: c.rationale ?? c.description ?? "",
    url: c.url ?? undefined,
    ...(c.price ? { pricing: { value: c.price, rationale: "Store listing price" } } : {}),
  };
}

export interface RunContextValue {
  /** Active run's idea, or null when idle. */
  idea: string | null;
  /** True when the run is the scripted demo (handled by RunStream, not the pipeline). */
  demo: boolean;
  phase: Phase;
  validation: Validation;
  opportunity: Opportunity;
  globalRadar: GlobalRadar;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  /** Stable mock run for the fallback / mock view (created on first need). */
  ensureMockRun: () => Run;
  /** Begin a run (resets prior state). */
  start: (idea: string, demo: boolean) => void;
  /** End the current run and return to the idle form. */
  restart: () => void;
}

const RunContext = createContext<RunContextValue | null>(null);

/**
 * Owns the entire run lifecycle (pipeline + all step state) so it survives
 * client-side navigation: mounted ONCE in the root layout, it keeps running
 * while the user visits /digest and is fully restored when they return. The
 * `/` page renders only a stateless VIEW (ScoutRun) that reads this context.
 */
export function RunProvider({ children }: { children: React.ReactNode }) {
  const [idea, setIdea] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "expanding" });
  const [validation, setValidation] = useState<Validation>({ kind: "idle" });
  const [opportunity, setOpportunity] = useState<Opportunity>({ kind: "idle" });
  const [globalRadar, setGlobalRadar] = useState<GlobalRadar>({ kind: "idle" });
  const [viewMode, setViewMode] = useState<ViewMode>("real");
  const cancelled = useRef(false);
  const mockRunRef = useRef<Run | null>(null);

  const start = useCallback((nextIdea: string, nextDemo: boolean) => {
    mockRunRef.current = null;
    setPhase({ kind: "expanding" });
    setValidation({ kind: "idle" });
    setOpportunity({ kind: "idle" });
    setGlobalRadar({ kind: "idle" });
    setViewMode("real");
    setDemo(nextDemo);
    setIdea(nextIdea);
  }, []);

  const restart = useCallback(() => {
    stopBackgroundMusic();
    mockRunRef.current = null;
    setIdea(null);
    setDemo(false);
  }, []);

  const ensureMockRun = useCallback(() => {
    if (!mockRunRef.current) mockRunRef.current = randomMockRun();
    return mockRunRef.current;
  }, []);

  // Real pipeline: idea → /search-intent → /scout (poll) → validate + opportunity
  // + global-radar (parallel). Lives here (not in the view) so navigating away
  // does NOT cancel it. Skipped for the scripted demo.
  useEffect(() => {
    if (idea === null || demo) return;
    cancelled.current = false;

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

    async function runValidation(activeIdea: string, competitors: Competitor[]): Promise<void> {
      setValidation({ kind: "running" });
      try {
        const res = await fetch(apiUrl("/validate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idea: activeIdea,
            competitors: competitors.map(toAgentCompetitor),
          }),
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

    async function runOpportunity(activeIdea: string, scoutId: string): Promise<void> {
      setOpportunity({ kind: "running" });
      try {
        const res = await fetch(apiUrl("/opportunity"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idea: activeIdea, scoutId }),
        });
        if (!res.ok) {
          const e = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(e.error ?? `opportunity failed (${res.status})`);
        }
        const data = (await res.json()) as {
          report: OpportunityReport;
          profiles: CompetitorProfile[];
        };
        if (cancelled.current) return;
        setOpportunity({ kind: "done", report: data.report, profiles: data.profiles });
      } catch (err) {
        if (!cancelled.current) {
          setOpportunity({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    async function runGlobalRadar(activeIdea: string): Promise<void> {
      setGlobalRadar({ kind: "running" });
      try {
        const res = await fetch(apiUrl("/global-radar"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idea: activeIdea }),
        });
        if (!res.ok) {
          const e = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(e.error ?? `global-radar failed (${res.status})`);
        }
        const radar = (await res.json()) as GlobalNicheRadarResult;
        if (cancelled.current) return;
        setGlobalRadar({ kind: "done", radar });
      } catch (err) {
        if (!cancelled.current) {
          setGlobalRadar({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    const activeIdea = idea;
    let expansion: SearchExpansion | undefined;
    const startTimer = window.setTimeout(() => {
      (async () => {
        try {
          const siRes = await fetch(apiUrl("/search-intent"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: activeIdea }),
          });
          if (!siRes.ok) {
            const e = (await siRes.json().catch(() => ({}))) as { error?: string };
            throw new Error(e.error ?? `search-intent failed (${siRes.status})`);
          }
          expansion = (await siRes.json()) as SearchExpansion;
          if (cancelled.current) return;

          const scoutRes = await fetch(apiUrl("/scout"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              keywords: expansion.keywords,
              categories: expansion.categories,
              idea: activeIdea,
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
          await Promise.all([
            runValidation(activeIdea, competitors),
            runOpportunity(activeIdea, scoutId),
            runGlobalRadar(activeIdea),
          ]);
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
    }, 0);

    return () => {
      cancelled.current = true;
      window.clearTimeout(startTimer);
    };
  }, [idea, demo]);

  return (
    <RunContext.Provider
      value={{
        idea,
        demo,
        phase,
        validation,
        opportunity,
        globalRadar,
        viewMode,
        setViewMode,
        ensureMockRun,
        start,
        restart,
      }}
    >
      {children}
    </RunContext.Provider>
  );
}

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRun must be used within a RunProvider");
  return ctx;
}
