import type { Assumptions, Citation } from "@hahaton/contracts";
import { computeUnitEconomics } from "@hahaton/unit-economics";
import { EmptyState, SectionShell } from "./section-shell";
import { FactValue } from "./fact-value";

const ASSUMPTION_FIELDS: { key: keyof Assumptions; label: string }[] = [
  { key: "arpu", label: "ARPU" },
  { key: "grossMarginPct", label: "Gross margin" },
  { key: "cac", label: "CAC" },
  { key: "monthlyChurnPct", label: "Monthly churn" },
  { key: "conversionPct", label: "Conversion" },
  { key: "fixedMonthlyCost", label: "Fixed cost / mo" },
  { key: "funnelVolume", label: "Funnel / mo" },
];

const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return compactFmt.format(n);
}

function isAssumptionsEmpty(a: Assumptions): boolean {
  return ASSUMPTION_FIELDS.every((f) => a[f.key].value === 0);
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
      description="LLM-produced assumptions; derived metrics computed deterministically. Interactive sliders ship in C5."
    >
      {!assumptions || isAssumptionsEmpty(assumptions) ? (
        <EmptyState message="Unit-economics assumptions have not been produced yet." />
      ) : (
        <UnitEconomicsContent assumptions={assumptions} citations={citations} />
      )}
    </SectionShell>
  );
}

function UnitEconomicsContent({
  assumptions,
  citations,
}: {
  assumptions: Assumptions;
  citations: Citation[];
}) {
  const derived = computeUnitEconomics(assumptions);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Assumptions
        </h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASSUMPTION_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {f.label}
              </span>
              <FactValue fact={assumptions[f.key]} citations={citations} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Derived
        </h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="LTV" value={fmtNumber(derived.ltv)} />
          <Metric label="LTV : CAC" value={Number.isFinite(derived.ltvCacRatio) ? derived.ltvCacRatio.toFixed(1) : "∞"} />
          <Metric label="Payback" value={Number.isFinite(derived.paybackMonths) ? `${derived.paybackMonths.toFixed(0)} mo` : "∞"} />
          <Metric label="Contribution / customer" value={fmtNumber(derived.contributionPerCustomer)} />
          <Metric label="Break-even customers" value={fmtNumber(derived.breakEvenCustomers)} />
          <Metric label="Monthly burn" value={fmtNumber(derived.monthlyBurn)} />
        </div>
      </div>

      {derived.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {derived.warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-3.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
