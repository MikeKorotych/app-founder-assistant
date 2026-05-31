"use client";

import type { OpportunityReport, ReviewCluster, ReviewSignalKind } from "@hahaton/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@hahaton/ui";
import type { ReactNode } from "react";

// Ukrainian labels for each signal kind (chips on the cluster lists).
const KIND_LABEL: Record<ReviewSignalKind, string> = {
  pain: "Біль",
  praised_feature: "Хвалять",
  missing_feature: "Бракує фічі",
  pricing_issue: "Ціна / paywall",
  ux_issue: "UX",
  reliability_bug: "Баги / надійність",
  onboarding_confusion: "Онбординг",
  switching_reason: "Причина переходу",
  audience_hint: "Аудиторія",
};

function ClusterRow({ c }: { c: ReviewCluster }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border/60 py-2.5 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{c.label}</span>
        <span className="shrink-0 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {KIND_LABEL[c.kind]} · {c.count}
        </span>
      </div>
      {c.examples[0] && (
        <p className="text-xs italic leading-relaxed text-muted-foreground">“{c.examples[0]}”</p>
      )}
    </div>
  );
}

// One "radar cell" — a labelled narrative insight.
function Cell({
  tag,
  title,
  children,
  accent,
}: {
  tag: string;
  title: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border p-4 ${
        accent ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/30"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {tag}
      </p>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * Opportunity Radar — renders the decision map mined from competitor reviews.
 * Presentational only; the report is built upstream (scout reviews → classify →
 * cluster → synthesize). Frames everything as "what to test first", not a verdict.
 */
export function OpportunityRadar({ report }: { report: OpportunityReport }) {
  const { topPains, loved, oneTwoStarReasons, reviewsAnalyzed, sources } = report;
  const sourceLine = sources.map((s) => `${s.source}: ${s.reviews}`).join(" · ");

  return (
    <Card className="animate-enter border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <CardHeader className="gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">Opportunity Radar</CardTitle>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {reviewsAnalyzed} відгуків
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Карта рішень із реальних відгуків конкурентів — <b>що перевірити першим</b>, а не вирок
          «ідея хороша/погана».
          {sourceLine && <span className="block text-xs opacity-70">Джерела — {sourceLine}</span>}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Narrative radar grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Cell tag="Червона зона" title="Де ринок перегрітий">
            {report.saturation || "—"}
          </Cell>
          <Cell tag="Вікно можливості" title="Незакрита ніша" accent>
            {report.opportunityGap || "—"}
          </Cell>
          <Cell tag="Перший ICP" title="Кого брати першими">
            {report.firstIcp || "—"}
          </Cell>
          <Cell tag="Диференціація" title="Чим відрізнятися">
            {report.differentiation || "—"}
          </Cell>
          <Cell tag="MVP за 7 днів" title="Що перевірити вже зараз" accent>
            {report.sevenDayTest || "—"}
          </Cell>
          <Cell tag="Kill criterion" title="Коли закрити ідею">
            {report.killCriterion || "—"}
          </Cell>
        </div>

        {/* Pains + praised clusters */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Повторювані болі
            </p>
            {topPains.length ? (
              topPains.map((c) => <ClusterRow key={`${c.kind}-${c.label}`} c={c} />)
            ) : (
              <p className="py-2 text-sm text-muted-foreground">—</p>
            )}
          </div>
          <div className="flex flex-col">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Що хвалять
            </p>
            {loved.length ? (
              loved.map((c) => <ClusterRow key={`${c.kind}-${c.label}`} c={c} />)
            ) : (
              <p className="py-2 text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* 1–2★ reasons */}
        {oneTwoStarReasons.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Чому ставлять 1–2★
            </p>
            <ul className="flex flex-col gap-1">
              {oneTwoStarReasons.map((r) => (
                <li key={r} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="select-none text-muted-foreground/60">—</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
