import type { ValidationPersonaResult, ValidationResult, ValidationScore } from "@hahaton/contracts";
import { EmptyState, SectionShell } from "./section-shell";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<keyof ValidationScore, string> = {
  problemMarket: "Проблема × Ринок",
  solutionDiff: "Рішення × Диф.",
  businessModel: "Модель × Юніт-ек.",
  gtmTraction: "GTM × Тяга",
};

const PERSONA_META: Record<
  ValidationPersonaResult["persona"],
  { label: string; color: string; bg: string; border: string }
> = {
  skeptic: {
    label: "Скептик-інвестор",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
  advocate: {
    label: "Адвокат",
    color: "text-teal-500",
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
  },
  analyst: {
    label: "Нейтральний аналітик",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
};

// ---------------------------------------------------------------------------
// Score bar — visual /25 indicator
// ---------------------------------------------------------------------------

function ScoreBar({ value, max = 25, color }: { value: number; max?: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-semibold tabular-nums">
        {value}<span className="font-normal text-muted-foreground">/25</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Persona card
// ---------------------------------------------------------------------------

function PersonaCard({ result }: { result: ValidationPersonaResult }) {
  const meta = PERSONA_META[result.persona];
  const cats = Object.keys(CATEGORY_LABELS) as (keyof ValidationScore)[];

  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-4 ${meta.border} ${meta.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {meta.label}
        </span>
        <span className={`text-2xl font-black tabular-nums ${meta.color}`}>
          {result.total}
          <span className="text-sm font-normal text-muted-foreground">/100</span>
        </span>
      </div>

      {/* Per-category scores */}
      <div className="flex flex-col gap-2">
        {cats.map((cat) => (
          <div key={cat}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
            </div>
            <ScoreBar value={result.scores[cat]} color={`${meta.color} opacity-80`} />
            {result.rationale[cat] && (
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {result.rationale[cat]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Consensus row
// ---------------------------------------------------------------------------

function ConsensusRow({
  category,
  consensus,
  personas,
}: {
  category: keyof ValidationScore;
  consensus: ValidationScore;
  personas: ValidationPersonaResult[];
}) {
  const scores = personas.map((p) => p.scores[category]);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const spread = max - min;

  return (
    <tr className="border-t border-border/60 align-middle">
      <td className="px-3 py-2.5 text-sm font-medium">{CATEGORY_LABELS[category]}</td>
      {personas.map((p) => (
        <td key={p.persona} className="px-3 py-2.5 text-center text-sm tabular-nums">
          <span className={PERSONA_META[p.persona].color}>{p.scores[category]}</span>
        </td>
      ))}
      <td className="px-3 py-2.5 text-center text-sm font-semibold tabular-nums">
        {consensus[category]}
      </td>
      <td className="px-3 py-2.5 text-center">
        {spread > 5 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
            ⚡ {spread} балів
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// CustDev questions for disagreements
// ---------------------------------------------------------------------------

function DisagreementsPanel({ result }: { result: ValidationResult }) {
  if (result.disagreements.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-500">
        ⚡ Ключові ризики — закрий їх до пітчу
      </p>
      <ul className="flex flex-col gap-2.5">
        {result.disagreements.map((d) => (
          <li key={d.category} className="flex gap-2 text-sm">
            <span className="shrink-0 font-medium text-foreground/80">
              {CATEGORY_LABELS[d.category]}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-foreground/70">{d.custDevQuestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ValidationSection({ validation }: { validation: ValidationResult | undefined }) {
  if (!validation) {
    return (
      <SectionShell
        step="9 · validation"
        title="Multi-LLM панель валідації"
        description="Три AI-персони оцінюють ідею за 4 категоріями (×25 → /100)."
      >
        <EmptyState message="Валідація поки недоступна." />
      </SectionShell>
    );
  }

  const cats = Object.keys(CATEGORY_LABELS) as (keyof ValidationScore)[];

  return (
    <SectionShell
      step="9 · validation"
      title="Multi-LLM панель валідації"
      description="Три AI-персони незалежно оцінюють ідею. Там, де розкид > 5 балів — твої головні питання для CustDev."
    >
      <div className="flex flex-col gap-6">
        {/* Total score */}
        <div className="flex items-center gap-4">
          <span className="text-5xl font-black tabular-nums">{validation.totalScore}</span>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Консенсус-оцінка</span>
            <span className="text-xs text-muted-foreground">зі 100</span>
          </div>
        </div>

        {/* 3 persona cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {validation.personas.map((p) => (
            <PersonaCard key={p.persona} result={p} />
          ))}
        </div>

        {/* Comparison table */}
        <div className="overflow-hidden rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Категорія</th>
                {validation.personas.map((p) => (
                  <th key={p.persona} className={`px-3 py-2 text-center font-medium ${PERSONA_META[p.persona].color}`}>
                    {PERSONA_META[p.persona].label.split(" ")[0]}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-medium">Сер.</th>
                <th className="px-3 py-2 text-center font-medium">Розкид</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((cat) => (
                <ConsensusRow
                  key={cat}
                  category={cat}
                  consensus={validation.consensus}
                  personas={validation.personas}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* CustDev risks */}
        <DisagreementsPanel result={validation} />
      </div>
    </SectionShell>
  );
}
