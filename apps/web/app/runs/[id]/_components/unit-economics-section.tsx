import type { Assumptions, Citation } from "@hahaton/contracts";
import { EmptyState, SectionShell } from "./section-shell";
import { InteractiveUnitEconomics } from "./interactive-unit-economics";

function isAssumptionsEmpty(a: Assumptions): boolean {
  return (
    a.arpu.value === 0 &&
    a.grossMarginPct.value === 0 &&
    a.cac.value === 0 &&
    a.monthlyChurnPct.value === 0 &&
    a.conversionPct.value === 0 &&
    a.fixedMonthlyCost.value === 0 &&
    a.funnelVolume.value === 0
  );
}

export function UnitEconomicsSection({
  assumptions,
  citations,
}: {
  assumptions: Assumptions | undefined;
  citations: Citation[];
}) {
  return (
    <SectionShell
      step="6 · unit economics"
      title="Unit economics"
      description="LLM-produced assumptions; derived metrics computed deterministically. Drag any slider to stress-test the model."
    >
      {!assumptions || isAssumptionsEmpty(assumptions) ? (
        <EmptyState message="Unit-economics assumptions have not been produced yet." />
      ) : (
        <InteractiveUnitEconomics assumptions={assumptions} citations={citations} />
      )}
    </SectionShell>
  );
}
