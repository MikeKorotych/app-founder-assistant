import type { Run } from "@hahaton/contracts";
import { Button } from "@hahaton/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefSection } from "./_components/brief-section";
import { CanvasSection } from "./_components/canvas-section";
import { CompetitorsSection } from "./_components/competitors-section";
import { GtmSection } from "./_components/gtm-section";
import { MarketSection } from "./_components/market-section";
import { RisksSection } from "./_components/risks-section";
import { SynthesisSection } from "./_components/synthesis-section";
import { UnitEconomicsSection } from "./_components/unit-economics-section";
import { ValidationSection } from "./_components/validation-section";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

async function fetchRun(id: string): Promise<Run | null> {
  const res = await fetch(`${API_URL}/runs/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load run ${id}: ${res.status}`);
  return (await res.json()) as Run;
}

const STATUS_LABEL: Record<Run["status"], string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await fetchRun(id);
  if (!run) notFound();

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Run
          </p>
          <h1 className="font-mono text-lg">{run.id}</h1>
          <p className="text-sm text-muted-foreground">
            {STATUS_LABEL[run.status]} · idea:{" "}
            <span className="text-foreground/85">{run.input.idea}</span>
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">New run</Button>
        </Link>
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
