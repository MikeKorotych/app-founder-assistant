"use client";

import type { Assumptions, Citation } from "@hahaton/contracts";
import { Button } from "@hahaton/ui";
import { computeUnitEconomics } from "@hahaton/unit-economics";
import { useMemo, useState } from "react";

interface Field {
  key: keyof Assumptions;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

// Pragmatic ranges: cover the realistic spread for an early-stage SaaS / consumer
// product. Steps are coarse enough that dragging feels snappy, fine enough that
// LTV:CAC and payback don't jump in big jagged steps.
const FIELDS: Field[] = [
  { key: "arpu", label: "ARPU", min: 0, max: 500, step: 1, unit: "USD/mo" },
  { key: "grossMarginPct", label: "Валова маржа", min: 0, max: 100, step: 1, unit: "%" },
  { key: "cac", label: "CAC", min: 0, max: 1000, step: 5, unit: "USD" },
  { key: "monthlyChurnPct", label: "Місячний churn", min: 0, max: 30, step: 0.5, unit: "%" },
  { key: "conversionPct", label: "Конверсія", min: 0, max: 100, step: 0.5, unit: "%" },
  { key: "fixedMonthlyCost", label: "Фікс. витрати / міс", min: 0, max: 50000, step: 100, unit: "USD" },
  { key: "funnelVolume", label: "Воронка / міс", min: 0, max: 100000, step: 100, unit: "users" },
];

const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return compactFmt.format(n);
}

function fmtAssumption(n: number, unit: string): string {
  if (unit === "%") return `${n}%`;
  return `${compactFmt.format(n)} ${unit}`;
}

type ValuesByKey = Record<keyof Assumptions, number>;

function extractValues(a: Assumptions): ValuesByKey {
  return {
    arpu: a.arpu.value,
    grossMarginPct: a.grossMarginPct.value,
    cac: a.cac.value,
    monthlyChurnPct: a.monthlyChurnPct.value,
    conversionPct: a.conversionPct.value,
    fixedMonthlyCost: a.fixedMonthlyCost.value,
    funnelVolume: a.funnelVolume.value,
  };
}

function assumptionsFromValues(original: Assumptions, values: ValuesByKey): Assumptions {
  return {
    arpu: { ...original.arpu, value: values.arpu },
    grossMarginPct: { ...original.grossMarginPct, value: values.grossMarginPct },
    cac: { ...original.cac, value: values.cac },
    monthlyChurnPct: { ...original.monthlyChurnPct, value: values.monthlyChurnPct },
    conversionPct: { ...original.conversionPct, value: values.conversionPct },
    fixedMonthlyCost: { ...original.fixedMonthlyCost, value: values.fixedMonthlyCost },
    funnelVolume: { ...original.funnelVolume, value: values.funnelVolume },
  };
}

export function InteractiveUnitEconomics({
  assumptions,
  citations,
}: {
  assumptions: Assumptions;
  citations: Citation[];
}) {
  const original = useMemo(() => extractValues(assumptions), [assumptions]);
  const [values, setValues] = useState<ValuesByKey>(original);

  const derived = useMemo(
    () => computeUnitEconomics(assumptionsFromValues(assumptions, values)),
    [assumptions, values],
  );

  const dirty = (FIELDS as Field[]).some((f) => values[f.key] !== original[f.key]);

  function setField(key: keyof Assumptions, raw: string) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setValues((prev) => ({ ...prev, [key]: n }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Припущення {dirty && <span className="text-foreground">· змінено</span>}
        </h4>
        {dirty && (
          <Button variant="outline" size="sm" onClick={() => setValues(original)}>
            Скинути до значень агента
          </Button>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => {
          const value = values[f.key];
          const fact = assumptions[f.key];
          const citation = fact.citationId
            ? citations.find((c) => c.id === fact.citationId)
            : undefined;
          const changed = value !== original[f.key];
          return (
            <div key={f.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor={`ue-${f.key}`}
                  className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
                >
                  {f.label}
                </label>
                <span
                  className={`text-sm font-semibold tabular-nums ${changed ? "text-foreground" : "text-foreground/85"}`}
                >
                  {fmtAssumption(value, f.unit)}
                </span>
              </div>
              <input
                id={`ue-${f.key}`}
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={value}
                onChange={(e) => setField(f.key, e.target.value)}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
              />
              {fact.rationale && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {fact.rationale}
                </p>
              )}
              {citation && (
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
                >
                  ↗ {citation.title || new URL(citation.url).hostname}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Похідні
        </h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="LTV" value={fmtNumber(derived.ltv)} />
          <Metric
            label="LTV : CAC"
            value={Number.isFinite(derived.ltvCacRatio) ? derived.ltvCacRatio.toFixed(1) : "∞"}
          />
          <Metric
            label="Окупність"
            value={
              Number.isFinite(derived.paybackMonths)
                ? `${derived.paybackMonths.toFixed(0)} міс`
                : "∞"
            }
          />
          <Metric
            label="Внесок / клієнт"
            value={fmtNumber(derived.contributionPerCustomer)}
          />
          <Metric label="Клієнтів до беззбитковості" value={fmtNumber(derived.breakEvenCustomers)} />
          <Metric label="Місячний burn" value={fmtNumber(derived.monthlyBurn)} />
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
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
