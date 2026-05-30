"use client";

import type { Run } from "@hahaton/contracts";
import { BriefSection } from "../runs/[id]/_components/brief-section";
import { CanvasSection } from "../runs/[id]/_components/canvas-section";
import { CompetitorsSection } from "../runs/[id]/_components/competitors-section";
import { GtmSection } from "../runs/[id]/_components/gtm-section";
import { MarketSection } from "../runs/[id]/_components/market-section";
import { RisksSection } from "../runs/[id]/_components/risks-section";
import { SynthesisSection } from "../runs/[id]/_components/synthesis-section";
import { UnitEconomicsSection } from "../runs/[id]/_components/unit-economics-section";
import { ValidationSection } from "../runs/[id]/_components/validation-section";

/** Renders all report sections from a Run. Shared by the server run page and
 *  the client-side demo fallback (so the report needs no API to display). */
export function ReportBody({ run }: { run: Run }) {
  return (
    <div className="stagger-enter flex flex-col gap-5">
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
  );
}
