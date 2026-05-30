import type { Citation, CompetitorScan } from "@hahaton/contracts";
import { EmptyState, SectionShell } from "./section-shell";

export function CompetitorsSection({
  scan,
  citations,
}: {
  scan: CompetitorScan | undefined;
  citations: Citation[];
}) {
  const competitors = scan?.competitors ?? [];

  return (
    <SectionShell
      step="3 · competitors"
      title="Скан конкурентів"
      description="Реальні компанії в ніші, знайдені через веб-ресерч."
    >
      {competitors.length === 0 ? (
        <EmptyState message="Конкурентів поки не знайдено." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {competitors.map((c, i) => {
            const citation = c.citationId
              ? citations.find((cn) => cn.id === c.citationId)
              : undefined;
            return (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold leading-tight">{c.name}</h3>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
                    >
                      сайт ↗
                    </a>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-foreground/85">{c.positioning}</p>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {c.pricing && (
                    <>
                      <dt className="text-muted-foreground">Ціни</dt>
                      <dd className="font-medium">
                        {String(c.pricing.value)}
                        {c.pricing.estimated && (
                          <span className="ml-1 text-muted-foreground">(оцінка)</span>
                        )}
                      </dd>
                    </>
                  )}
                  {c.funding && (
                    <>
                      <dt className="text-muted-foreground">Фінансування</dt>
                      <dd className="font-medium">
                        {String(c.funding.value)}
                        {c.funding.estimated && (
                          <span className="ml-1 text-muted-foreground">(оцінка)</span>
                        )}
                      </dd>
                    </>
                  )}
                </dl>
                {citation && (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
                  >
                    джерело ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
