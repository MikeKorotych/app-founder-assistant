import type { Assumptions, Citation } from "@hahaton/contracts";
import { InteractiveUnitEconomics } from "./interactive-unit-economics";
import { EmptyState, SectionShell } from "./section-shell";

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
      title="Юніт-економіка"
      description="Припущення від LLM; похідні метрики рахуються детерміновано. Тягни будь-який слайдер, щоб стрес-тестувати модель."
    >
      {!assumptions || isAssumptionsEmpty(assumptions) ? (
        <EmptyState message="Припущення юніт-економіки ще не сформовано." />
      ) : (
        <InteractiveUnitEconomics assumptions={assumptions} citations={citations} />
      )}
    </SectionShell>
  );
}
