"use client";

import type { SearchExpansion } from "@hahaton/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@hahaton/ui";
import { ValidationSection } from "../runs/[id]/_components/validation-section";
import { CompetitiveLandscape } from "./competitive-landscape";
import { Game2048 } from "./game-2048";
import { GlobalNicheRadar } from "./global-niche-radar";
import { IdeaGraph } from "./idea-graph";
import { MarketDataMock } from "./market-data-mock";
import { OpportunityRadar } from "./opportunity-radar";
import { PlatformPie } from "./platform-pie";
import { ReportBody } from "./report-body";
import {
  type Competitor,
  type GlobalRadar,
  type Opportunity,
  type Phase,
  useRun,
  type Validation,
  type ViewMode,
} from "./run-context";
import { ScoutLoading } from "./scout-loading";

type ProgressState = "done" | "active" | "waiting";

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

function RunTopBar({
  idea,
  mode,
  onModeChange,
  onRestart,
}: {
  idea: string;
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  onRestart?: () => void;
}) {
  const restart = () => (onRestart ? onRestart() : window.location.assign("/"));
  return (
    <div className="animate-enter flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {mode === "real" ? "Реальний прогін" : "Мок-прогін"}
        </p>
        <p className="max-w-3xl truncate text-sm text-muted-foreground">{idea}</p>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        <div className="inline-flex rounded-md border border-border/60 bg-background/35 p-1 backdrop-blur">
          {(["real", "mock"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onModeChange(item)}
              className={cn(
                "h-8 rounded px-3 text-xs font-medium transition-colors",
                mode === item
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {item === "real" ? "Реальний" : "Mock"}
            </button>
          ))}
        </div>
        <Button
          aria-label="Новий прогін"
          className="h-9 w-9 shrink-0 text-muted-foreground [&_svg]:size-5"
          onClick={restart}
          size="icon"
          title="Новий прогін"
          variant="ghost"
        >
          <RestartIcon />
        </Button>
      </div>
    </div>
  );
}

function progressFor(
  phase: Phase,
  validation: Validation,
  opportunity: Opportunity,
  globalRadar: GlobalRadar,
) {
  const hasExpansion = "expansion" in phase && Boolean(phase.expansion);
  const insightsDone =
    (opportunity.kind === "done" || opportunity.kind === "error") &&
    (globalRadar.kind === "done" || globalRadar.kind === "error");
  return [
    { label: "Ідея", state: "done" as ProgressState },
    {
      label: "Ключі",
      state: (hasExpansion ? "done" : "active") as ProgressState,
    },
    {
      label: "Scout",
      state: (phase.kind === "done"
        ? "done"
        : hasExpansion
          ? "active"
          : "waiting") as ProgressState,
    },
    {
      label: "Конкуренти",
      state: (phase.kind === "done" ? "done" : "waiting") as ProgressState,
    },
    {
      label: "Валідація",
      state: (validation.kind === "done"
        ? "done"
        : validation.kind === "running" || phase.kind === "done"
          ? "active"
          : "waiting") as ProgressState,
    },
    {
      label: "Інсайти",
      state: (insightsDone
        ? "done"
        : phase.kind === "done"
          ? "active"
          : "waiting") as ProgressState,
    },
  ];
}

function ProgressSlideBar({ steps }: { steps: { label: string; state: ProgressState }[] }) {
  const doneCount = steps.filter((step) => step.state === "done").length;
  const activeIndex = steps.findIndex((step) => step.state === "active");
  const progressIndex = activeIndex === -1 ? doneCount - 1 : activeIndex;
  const pct = Math.max(0, Math.min(100, (progressIndex / (steps.length - 1)) * 100));
  const active = steps.some((step) => step.state === "active");

  return (
    <Card className="animate-enter border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <CardContent className="py-4">
        <style>{`@keyframes ps-shimmer { 0% { transform: translateX(-110%); } 100% { transform: translateX(420%); } } .ps-shimmer { animation: ps-shimmer 1.9s ease-in-out infinite; }`}</style>
        <div className="relative flex flex-col gap-3">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted/45">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
            {active && (
              <div className="ps-shimmer absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-foreground/50 to-transparent" />
            )}
          </div>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          >
            {steps.map((step, index) => (
              <div
                key={step.label}
                className="animate-enter flex min-w-0 flex-col gap-1"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    step.state === "done"
                      ? "bg-foreground"
                      : step.state === "active"
                        ? "bg-foreground/80 shadow-[0_0_0_4px_rgba(255,255,255,0.08)]"
                        : "bg-muted-foreground/30",
                  )}
                />
                <span
                  className={cn(
                    "truncate text-[10px] font-medium uppercase tracking-[0.14em]",
                    step.state === "waiting" ? "text-muted-foreground/55" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GameWhileGenerating({ phase, validation }: { phase: Phase; validation: Validation }) {
  const label =
    phase.kind === "expanding"
      ? "Виділяємо пошуковий намір"
      : phase.kind === "scanning"
        ? "Scout збирає конкурентів"
        : validation.kind === "running"
          ? "Multi-LLM панель оцінює ідею"
          : "Готуємо звіт";

  return (
    <Card className="animate-enter overflow-hidden border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <CardContent className="flex flex-col gap-6 py-5">
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Поки генерується аналіз
          </p>
          <h2 className="text-xl font-semibold tracking-tight">{label}</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Реальний пайплайн працює у фоні: пошукові ключі, Scout, конкуренти та валідація
            з'являються по мірі готовності.
          </p>
        </div>
        <div className="self-center">
          <Game2048 />
        </div>
      </CardContent>
    </Card>
  );
}

function SearchIntentSection({
  idea,
  phase,
  expansion,
}: {
  idea: string;
  phase: Phase;
  expansion?: SearchExpansion;
}) {
  return (
    <section className="scroll-mt-10">
      <Card className="animate-enter border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <CardHeader className="gap-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Крок · 1 · search intent
          </p>
          <CardTitle className="text-xl">Пошуковий намір</CardTitle>
          <p className="text-sm text-muted-foreground">{idea}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {phase.kind === "expanding" && (
            <p className="text-sm text-muted-foreground/70">
              Виділяємо ключові слова та категорії…
            </p>
          )}

          {expansion && (
            <div className="animate-enter flex flex-col gap-3">
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <span>Категорії · {expansion.categories.length}</span>
                <span>Ключові слова · {expansion.keywords.length}</span>
              </div>
              <IdeaGraph
                idea={idea}
                categories={expansion.categories}
                keywords={expansion.keywords}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// Stateless VIEW of the run. All lifecycle + state lives in RunProvider (mounted
// in the root layout), so this component can unmount on navigation and remount
// on return without losing or restarting the run.
export function ScoutRun({ onRestart }: { onRestart?: () => void }) {
  const {
    idea,
    phase,
    validation,
    opportunity,
    globalRadar,
    viewMode,
    setViewMode,
    ensureMockRun,
  } = useRun();

  if (idea === null) return null;

  // On any failure we fall back to a random ready-made mock report — the demo never breaks.
  if (phase.kind === "error") {
    const run = ensureMockRun();
    return (
      <div className="flex flex-1 flex-col gap-6">
        <RunTopBar
          idea={run.input.idea}
          mode="mock"
          onModeChange={setViewMode}
          onRestart={onRestart}
        />
        <p className="animate-enter text-sm text-muted-foreground">
          Реальний прогін зупинився: {phase.message}. Показую мок-аналіз.
        </p>
        <ReportBody run={run} />
      </div>
    );
  }

  const expansion = "expansion" in phase ? phase.expansion : undefined;
  const progressSteps = progressFor(phase, validation, opportunity, globalRadar);
  const analysing =
    validation.kind === "running" ||
    opportunity.kind === "running" ||
    globalRadar.kind === "running";
  const isGenerating = phase.kind === "expanding" || phase.kind === "scanning" || analysing;

  if (viewMode === "mock") {
    const run = ensureMockRun();
    return (
      <div className="flex flex-col gap-6">
        <RunTopBar
          idea={run.input.idea}
          mode={viewMode}
          onModeChange={setViewMode}
          onRestart={onRestart}
        />
        <ReportBody run={run} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <RunTopBar idea={idea} mode={viewMode} onModeChange={setViewMode} onRestart={onRestart} />
      <ProgressSlideBar steps={progressSteps} />

      {/* Single live-progress loader for the whole process — always at the top. */}
      {phase.kind === "expanding" && (
        <ScoutLoading
          title="Розбираємо ідею…"
          hint="Виділяємо ключові слова та категорії для пошуку конкурентів."
        />
      )}
      {phase.kind === "scanning" && (
        <ScoutLoading
          title="Scout шукає конкурентів…"
          hint="Сканую iTunes, Google Play, Product Hunt та AlternativeTo за цими запитами."
          steps={[
            "Готуємо query-пакет для стора.",
            "Скануємо iTunes Search API.",
            "Зіставляємо Android-сигнали з Google Play.",
            "Перевіряємо Product Hunt та AlternativeTo.",
            "Прибираємо дублікати конкурентів.",
            "Ранжуємо результати за сумісністю.",
          ]}
        />
      )}
      {phase.kind === "done" && analysing && (
        <ScoutLoading
          title="Аналізуємо ідею…"
          hint="Валідація · відгуки конкурентів · світові чарти — паралельно."
          steps={[
            "Витягуємо відгуки конкурентів.",
            "Класифікуємо сигнали болю та похвали.",
            "Multi-LLM панель оцінює ідею.",
            "Скануємо світові чарти по країнах.",
            "Збираємо інсайти та можливості.",
          ]}
        />
      )}

      {isGenerating && <GameWhileGenerating phase={phase} validation={validation} />}

      {validation.kind === "done" && (
        <div className="animate-enter">
          <ValidationSection validation={validation.result} />
        </div>
      )}

      {validation.kind === "error" && (
        <p className="animate-enter text-sm text-destructive" role="alert">
          Валідація не вдалася: {validation.message}
        </p>
      )}

      <SearchIntentSection idea={idea} phase={phase} expansion={expansion} />

      {phase.kind === "done" && (
        <div className="animate-enter">
          <CompetitorList competitors={phase.competitors} />
        </div>
      )}

      {/* Market & revenue data (mock until paid market-intel APIs are connected). */}
      {phase.kind === "done" && <MarketDataMock competitors={phase.competitors} />}

      {/* Opportunity analysis — mined from competitor reviews. */}
      {opportunity.kind === "done" && (
        <div className="flex flex-col gap-6">
          <CompetitiveLandscape profiles={opportunity.profiles} />
          <OpportunityRadar report={opportunity.report} />
        </div>
      )}
      {opportunity.kind === "error" && (
        <p className="animate-enter text-sm text-muted-foreground" role="alert">
          Аналіз відгуків не вдався: {opportunity.message}
        </p>
      )}

      {/* Global Niche Radar — cross-country localized winners. */}
      {globalRadar.kind === "done" && <GlobalNicheRadar radar={globalRadar.radar} />}
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

// Ukrainian plural form picker: [one, few, many] (1 день / 2 дні / 5 днів).
function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

// "Launched N days ago" in Ukrainian from a launch ISO date (PH featured/created).
// Collapses to days → months → years; null for missing/invalid/future dates.
function launchedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "Запущено сьогодні";
  if (days < 30) return `Запущено ${days} ${plural(days, ["день", "дні", "днів"])} тому`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `Запущено ${months} ${plural(months, ["місяць", "місяці", "місяців"])} тому`;
  }
  const years = Math.floor(days / 365);
  return `Запущено ${years} ${plural(years, ["рік", "роки", "років"])} тому`;
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
      <section className="scroll-mt-10">
        <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardHeader className="gap-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Крок · 2 · scout
            </p>
            <CardTitle className="text-xl">Конкурентний ландшафт</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Конкурентів не знайдено для цих запитів. Спробуйте конкретнішу ідею.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }
  const groups = groupBySource(competitors);
  return (
    <section className="scroll-mt-10">
      <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <CardHeader className="gap-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Крок · 2 · scout
          </p>
          <CardTitle className="text-xl">Конкурентний ландшафт</CardTitle>
          <p className="text-sm text-muted-foreground">
            Реальні конкуренти з App Store, Google Play, Product Hunt та AlternativeTo.
          </p>
        </CardHeader>
        <CardContent>
          <div className="stagger-enter flex flex-col gap-5">
            <PlatformPie sources={competitors.map((c) => c.source)} />
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Конкуренти · {competitors.length}
            </p>
            {groups.map(([source, items]) => (
              <SourceTable key={source} source={source} items={items} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
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
                          {launchedLabel(c.launchedAt) && (
                            <span>{launchedLabel(c.launchedAt)}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {typeof c.compatibilityScore === "number" && c.compatibilityScore > 0 ? (
                      <span className="inline-block rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums">
                        {c.compatibilityScore}/100
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    {typeof c.compatibilityScore === "number" && c.compatibilityScore > 0
                      ? (c.rationale ?? "—")
                      : "—"}
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
