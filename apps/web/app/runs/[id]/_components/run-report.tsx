"use client";

import type { Run } from "@hahaton/contracts";
import { Button } from "@hahaton/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "../../../_lib/api";
import { BriefSection } from "./brief-section";
import { CanvasSection } from "./canvas-section";
import { CompetitorsSection } from "./competitors-section";
import { GtmSection } from "./gtm-section";
import { MarketSection } from "./market-section";
import { RisksSection } from "./risks-section";
import { SynthesisSection } from "./synthesis-section";
import { UnitEconomicsSection } from "./unit-economics-section";
import { ValidationSection } from "./validation-section";

const STATUS_LABEL: Record<Run["status"], string> = {
  running: "Виконується",
  completed: "Завершено",
  failed: "Помилка",
};

function RestartIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
    </svg>
  );
}

function NewRunLink() {
  return (
    <Button asChild className="h-11 w-11 shrink-0 [&_svg]:size-5" size="icon" variant="outline">
      <Link aria-label="Новий прогін" href="/" title="Новий прогін">
        <RestartIcon />
      </Link>
    </Button>
  );
}

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; run: Run };

// The run is fetched in the browser (the API enables open CORS). OpenNext on
// Cloudflare Workers can't reliably make the server→API worker-to-worker
// subrequest, so SSR fetching the run 404'd — all API access goes browser → API
// directly, like the idea/search forms.
export function RunReport({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/runs/${id}`), { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setState({ kind: "missing" });
          return;
        }
        if (!res.ok) throw new Error(`Не вдалося завантажити прогін ${id}: ${res.status}`);
        const run = (await res.json()) as Run;
        if (!cancelled) setState({ kind: "ready", run });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">Завантаження прогону…</p>;
  }
  if (state.kind === "missing") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Прогін не знайдено.</p>
        <NewRunLink />
      </div>
    );
  }
  if (state.kind === "error") {
    return <p className="text-sm text-destructive">{state.message}</p>;
  }

  const { run } = state;
  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Прогін
          </p>
          <h1 className="font-mono text-lg">{run.id}</h1>
          <p className="text-sm text-muted-foreground">
            {STATUS_LABEL[run.status]} · ідея:{" "}
            <span className="text-foreground/85">{run.input.idea}</span>
          </p>
        </div>
        <NewRunLink />
      </header>

      <div className="flex flex-col gap-5">
        <BriefSection brief={run.brief} />
        <MarketSection market={run.market} citations={run.citations} />
        <CompetitorsSection scan={run.competitors} citations={run.citations} />
        <CanvasSection canvas={run.canvas} />
        <GtmSection gtm={run.gtm} />
        <UnitEconomicsSection assumptions={run.assumptions} citations={run.citations} />
        <RisksSection register={run.risks} />
        <SynthesisSection synthesis={run.synthesis} />
        <ValidationSection validation={run.validation} />
      </div>
    </main>
  );
}
