import type { Citation, MarketSizing } from "@hahaton/contracts";
import { EmptyState, SectionShell } from "./section-shell";
import { FactValue } from "./fact-value";

export function MarketSection({ market, citations }: { market: MarketSizing | undefined; citations: Citation[] }) {
  return (
    <SectionShell
      step="2 · market"
      title="Market sizing"
      description="TAM / SAM / SOM. Every figure is grounded in a source or explicitly flagged as an estimate."
    >
      {!market ? (
        <EmptyState message="Market sizing has not been computed yet." />
      ) : (
        <div className="flex flex-col gap-5">
          <span className="w-fit rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Method · {market.method}
          </span>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">TAM</span>
              <FactValue fact={market.tam} citations={citations} size="lg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">SAM</span>
              <FactValue fact={market.sam} citations={citations} size="lg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">SOM</span>
              <FactValue fact={market.som} citations={citations} size="lg" />
            </div>
          </div>
          {market.notes && <p className="text-sm text-muted-foreground">{market.notes}</p>}
        </div>
      )}
    </SectionShell>
  );
}
