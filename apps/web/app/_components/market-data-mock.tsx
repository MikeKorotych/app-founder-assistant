"use client";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@hahaton/ui";
import { useMemo, useState } from "react";
import { UnitEconomicsSection } from "../runs/[id]/_components/unit-economics-section";
import { randomMockRun } from "./mock-run";

// Minimal shape we need from a discovered competitor (decoupled from scout-run's
// local Competitor row so this block stays self-contained).
interface MarketCompetitor {
  id: string;
  name: string;
  source: string;
  reviewCount: number;
  rating: number;
  url: string | null;
}

// Deterministic FNV-1a hash → a stable pseudo-random seed per competitor, so the
// estimates don't jitter between renders.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Estimated monthly installs + revenue. Anchored on the real review count where
// we have one (reviews ≈ ~1.6% of installs), with a stable name-seeded fallback.
// Blended monthly revenue-per-install (subscriptions + IAP + ads), nudged by the
// real rating. These are the figures a paid market-intelligence API would return.
function estimate(c: MarketCompetitor): { installs: number; revenue: number } {
  const seed = hash(c.name);
  const base = c.reviewCount > 0 ? c.reviewCount * 60 : 8000 + (seed % 92000);
  const installs = Math.round(base / 500) * 500;
  const rpd =
    0.22 + (hash(`${c.name}#rev`) % 46) / 100 + (c.rating > 0 ? (c.rating - 3) * 0.04 : 0);
  const revenue = Math.max(0, Math.round(installs * Math.max(0.05, rpd)));
  return { installs, revenue };
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

/**
 * Demo-safe "market & revenue data" block for the real scout run. We don't have
 * paid market-intelligence API keys, so this surfaces *estimated* monthly
 * installs / revenue / market share for the competitors actually discovered in
 * the run — clearly labelled as mock until a paid API (Appfigures · Sensor Tower
 * · data.ai) is connected, at which point these become real figures.
 */
export function MarketDataMock({ competitors }: { competitors: MarketCompetitor[] }) {
  const [open, setOpen] = useState(false);
  // Real scout runs carry no unit-economics, so reuse a (memoized) mock run's
  // assumptions for the interactive model — same demo-safe approach as the rest.
  const mock = useMemo(() => randomMockRun(), []);

  if (competitors.length === 0) return null;

  const rows = competitors
    .map((c) => ({ c, ...estimate(c) }))
    .sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalInstalls = rows.reduce((s, r) => s + r.installs, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Сховати дані ринку" : "Показати дані ринку"}
        </Button>
      </div>

      {open && (
        <div className="flex flex-col gap-5">
          <div className="animate-enter">
            <UnitEconomicsSection assumptions={mock.assumptions} citations={mock.citations ?? []} />
          </div>
          <Card className="animate-enter border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
            <CardHeader className="gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">Дані ринку та виручка конкурентів</CardTitle>
                <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  mock
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Орієнтовні оцінки на основі публічних сигналів (відгуки, рейтинг). Точні дані
                завантажень і виручки зʼявляться тут після підключення платних API — Appfigures,
                Sensor Tower, data.ai.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Виручка ніші · міс
                  </p>
                  <p className="text-lg font-semibold tabular-nums">~${compact(totalRevenue)}</p>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Завантаження · міс
                  </p>
                  <p className="text-lg font-semibold tabular-nums">~{compact(totalInstalls)}</p>
                </div>
                <div className="col-span-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 sm:col-span-1">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Гравців у вибірці
                  </p>
                  <p className="text-lg font-semibold tabular-nums">{rows.length}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-md border border-border/60">
                <div className="max-h-[34rem] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/95 text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Конкурент</th>
                        <th className="w-28 px-3 py-2 text-right font-medium">Завантаж./міс</th>
                        <th className="w-28 px-3 py-2 text-right font-medium">Виручка/міс</th>
                        <th className="w-32 px-3 py-2 text-right font-medium">Частка ринку</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ c, installs, revenue }) => {
                        const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
                        return (
                          <tr key={c.id} className="border-t border-border/60 align-middle">
                            <td className="px-3 py-2.5">
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
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                              ~{compact(installs)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                              ~${compact(revenue)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary/70"
                                    style={{ width: `${Math.min(100, share)}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right tabular-nums text-muted-foreground">
                                  {share.toFixed(0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
