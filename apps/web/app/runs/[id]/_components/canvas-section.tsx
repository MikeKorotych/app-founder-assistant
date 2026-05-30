import type { BusinessModelCanvas } from "@hahaton/contracts";
import { EmptyState, SectionShell } from "./section-shell";

const BLOCKS: { key: keyof BusinessModelCanvas; label: string }[] = [
  { key: "customerSegments", label: "Сегменти клієнтів" },
  { key: "valuePropositions", label: "Ціннісні пропозиції" },
  { key: "channels", label: "Канали" },
  { key: "customerRelationships", label: "Стосунки з клієнтами" },
  { key: "revenueStreams", label: "Потоки доходу" },
  { key: "keyResources", label: "Ключові ресурси" },
  { key: "keyActivities", label: "Ключові активності" },
  { key: "keyPartnerships", label: "Ключові партнерства" },
  { key: "costStructure", label: "Структура витрат" },
];

export function CanvasSection({ canvas }: { canvas: BusinessModelCanvas | undefined }) {
  const totalItems = canvas ? BLOCKS.reduce((n, b) => n + canvas[b.key].length, 0) : 0;

  return (
    <SectionShell
      step="4 · canvas"
      title="Бізнес-модель (Canvas)"
      description="Дев'ять блоків canvas, виведених із брифу та ринку."
    >
      {!canvas || totalItems === 0 ? (
        <EmptyState message="Canvas ще не згенеровано." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BLOCKS.map((b) => {
            const items = canvas[b.key];
            return (
              <div
                key={b.key}
                className="rounded-md border border-border/60 bg-background/40 p-3.5"
              >
                <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {b.label}
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
          })}
        </div>
      )}
    </SectionShell>
  );
}
