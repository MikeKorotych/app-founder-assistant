"use client";

import type { CompetitorProfile } from "@hahaton/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@hahaton/ui";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

// Deterministic install estimate fallback when the profile didn't carry one
// (reviews ≈ ~1.6% of installs; floored). Mirrors the Market Data block.
function installs(p: CompetitorProfile): number {
  if (p.estimatedInstalls && p.estimatedInstalls > 0) return p.estimatedInstalls;
  const base = p.reviewCount > 0 ? p.reviewCount * 60 : 0;
  return Math.round(base / 500) * 500;
}

function launchedLabel(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}`;
}

function Bullets({ items, tone }: { items: string[]; tone: "good" | "bad" }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">—</p>;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((s) => (
        <li key={s} className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <span className={`select-none ${tone === "good" ? "text-success" : "text-destructive"}`}>
            {tone === "good" ? "+" : "−"}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

function Tagline({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return null;
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium uppercase tracking-[0.12em] text-foreground/70">{label}</span>{" "}
      {value}
    </p>
  );
}

function ProfileCard({ p }: { p: CompetitorProfile }) {
  const launched = launchedLabel(p.launchedAt);
  const inst = installs(p);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/25 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          {p.url ? (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-2 hover:underline"
            >
              {p.name}
            </a>
          ) : (
            <span className="font-medium">{p.name}</span>
          )}
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{p.source}</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
          {p.rating ? <span>★ {p.rating.toFixed(1)}</span> : null}
          <span>
            {p.reviewCount > 0 ? `${p.reviewCount.toLocaleString()} відгуків` : "відгуки —"}
          </span>
          {p.installsText ? (
            <span title="Офіційний показник Google Play" className="text-foreground/80">
              {p.installsText} встановлень
            </span>
          ) : inst > 0 ? (
            <span>~{compact(inst)} вст. (оцінка)</span>
          ) : null}
          {launched && <span>з {launched}</span>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-success">
            Хвалять
          </p>
          <p className="text-sm text-foreground/85">{p.positiveTheme || "—"}</p>
          <div className="mt-1.5">
            <Bullets items={p.strengths} tone="good" />
          </div>
        </div>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-destructive">
            Скаржаться
          </p>
          <p className="text-sm text-foreground/85">{p.negativeTheme || "—"}</p>
          <div className="mt-1.5">
            <Bullets items={p.weaknesses} tone="bad" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-border/60 pt-2.5">
        <Tagline label="Ізюминка:" value={p.hook} />
        <Tagline label="Надихнутися:" value={p.inspiration} />
        <Tagline label="Уникати:" value={p.avoid} />
      </div>
    </div>
  );
}

/**
 * Competitive Landscape — at-a-glance picture of the niche's top players:
 * installs (est) / reviews / rating / age, plus the positive & negative review
 * themes, strengths, weaknesses, each one's hook, and what to be inspired by vs.
 * avoid. Presentational; profiles are synthesized upstream from competitor reviews.
 */
export function CompetitiveLandscape({ profiles }: { profiles: CompetitorProfile[] }) {
  if (!profiles.length) return null;
  return (
    <Card className="animate-enter border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-xl">Конкурентний ландшафт</CardTitle>
        <p className="text-sm text-muted-foreground">
          Картина по головних гравцях ніші: сильні та слабкі сторони, ізюминка кожного, чим
          надихнутися й чого уникати. Установки — оцінка; динаміка завантажень у часі зʼявиться
          після підключення платних API.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {profiles.map((p) => (
          <ProfileCard key={p.competitorId} p={p} />
        ))}
      </CardContent>
    </Card>
  );
}
