import type { Citation, MarketSizing } from "@hahaton/contracts";
import { FactValue } from "./fact-value";
import { EmptyState, SectionShell } from "./section-shell";

export function MarketSection({
  market,
  citations,
}: {
  market: MarketSizing | undefined;
  citations: Citation[];
}) {
  return (
    <SectionShell
      step="2 · market"
      title="Розмір ринку"
      description="TAM / SAM / SOM. Кожна цифра підкріплена джерелом або явно позначена як оцінка."
    >
      {!market ? (
        <EmptyState message="Розмір ринку ще не обчислено." />
      ) : (
        <div className="flex flex-col gap-5">
          <span className="w-fit rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Метод · {market.method}
          </span>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                TAM
              </span>
              <FactValue fact={market.tam} citations={citations} size="lg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                SAM
              </span>
              <FactValue fact={market.sam} citations={citations} size="lg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                SOM
              </span>
              <FactValue fact={market.som} citations={citations} size="lg" />
            </div>
          </div>
          {market.notes && <p className="text-sm text-muted-foreground">{market.notes}</p>}
        </div>
      )}
    </SectionShell>
  );
}
