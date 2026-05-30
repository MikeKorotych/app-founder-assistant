import type { GtmPlan } from "@hahaton/contracts";
import { EmptyState, SectionShell } from "./section-shell";

function PlanColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 p-3.5">
      <h4 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs italic text-muted-foreground/70">—</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((item, i) => (
            <li key={i} className="leading-snug">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GtmSection({ gtm }: { gtm: GtmPlan | undefined }) {
  const hasAny =
    gtm &&
    (gtm.channels.length > 0 ||
      gtm.plan30.length > 0 ||
      gtm.plan60.length > 0 ||
      gtm.plan90.length > 0 ||
      gtm.hypotheses.length > 0);

  return (
    <SectionShell
      step="5 · gtm"
      title="Вихід на ринок (GTM)"
      description="Канали та перші 30 / 60 / 90 днів виконання."
    >
      {!gtm || !hasAny ? (
        <EmptyState message="GTM-план ще не згенеровано." />
      ) : (
        <div className="flex flex-col gap-5">
          {gtm.channels.length > 0 && (
            <div>
              <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Канали
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {gtm.channels.map((ch, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-foreground/85"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <PlanColumn title="День 0–30" items={gtm.plan30} />
            <PlanColumn title="День 31–60" items={gtm.plan60} />
            <PlanColumn title="День 61–90" items={gtm.plan90} />
          </div>
          {gtm.hypotheses.length > 0 && (
            <div>
              <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Гіпотези для перевірки
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {gtm.hypotheses.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}
