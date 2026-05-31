"use client";

import type {
  GlobalNicheRadar as GlobalNicheRadarData,
  GlobalRadarEntry,
} from "@hahaton/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@hahaton/ui";

// ISO country code → flag emoji (regional indicator letters).
function flag(cc: string): string {
  if (cc.length !== 2) return cc.toUpperCase();
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => base + ch.charCodeAt(0) - 65));
}

function EntryRow({ e, home }: { e: GlobalRadarEntry; home: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/25 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          {e.url ? (
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-2 hover:underline"
            >
              {e.name}
            </a>
          ) : (
            <span className="font-medium">{e.name}</span>
          )}
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium tabular-nums">
            #{e.bestRank}
          </span>
        </div>
        <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          немає у {flag(home)} {home.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {e.markets.slice(0, 8).map((m) => (
          <span
            key={m.country}
            className="rounded border border-border/60 bg-background/40 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
            title={`${m.country.toUpperCase()} · #${m.rank}`}
          >
            {flag(m.country)} #{m.rank}
          </span>
        ))}
        {e.markets.length > 8 && (
          <span className="px-1 text-[11px] text-muted-foreground">+{e.markets.length - 8}</span>
        )}
      </div>

      {e.whatItDoes && <p className="text-sm text-foreground/85">{e.whatItDoes}</p>}
      {e.takeaway && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium uppercase tracking-[0.12em] text-foreground/70">
            Що взяти:
          </span>{" "}
          {e.takeaway}
        </p>
      )}
    </div>
  );
}

/**
 * Global Niche Radar — apps that chart in foreign markets but are absent in the
 * founder's home market (geo-arbitrage). Presentational; the radar is built
 * upstream from App Store country charts. Momentum/velocity over time is deferred
 * to paid APIs — this shows "ranks high abroad, missing at home" as the signal.
 */
export function GlobalNicheRadar({ radar }: { radar: GlobalNicheRadarData }) {
  if (radar.entries.length === 0) return null;
  return (
    <Card className="animate-enter border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <CardHeader className="gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-xl">Глобальний радар ніші</CardTitle>
          {radar.genreLabel && (
            <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {radar.genreLabel}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Застосунки, що зайшли в чарти інших країн, але відсутні у твоєму ринку (
          {radar.homeCountry.toUpperCase()}) — гео-арбітраж. Скановано{" "}
          {radar.countriesScanned.length} ринків. Динаміка зростання в часі зʼявиться після
          підключення платних API.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {radar.entries.map((e) => (
          <EntryRow key={e.appId} e={e} home={radar.homeCountry} />
        ))}
      </CardContent>
    </Card>
  );
}
