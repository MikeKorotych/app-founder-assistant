import type { Citation, Fact } from "@hahaton/contracts";

const compactFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function formatFactValue(value: unknown, unit?: string): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "∞";
    if (unit === "%") return `${value}%`;
    const compact = compactFmt.format(value);
    return unit ? `${compact} ${unit}` : compact;
  }
  if (typeof value === "string") return unit ? `${value} ${unit}` : value;
  return String(value);
}

interface Props<T> {
  fact: Fact<T>;
  citations: Citation[];
  size?: "sm" | "lg";
}

export function FactValue<T>({ fact, citations, size = "sm" }: Props<T>) {
  const citation = fact.citationId ? citations.find((c) => c.id === fact.citationId) : undefined;
  const display = formatFactValue(fact.value, fact.unit);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={
          size === "lg"
            ? "text-2xl font-semibold tracking-tight sm:text-3xl"
            : "text-base font-medium"
        }
      >
        {display}
        {fact.estimated && (
          <span className="ml-2 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground align-middle">
            est.
          </span>
        )}
      </div>
      {fact.rationale && (
        <p className="text-xs leading-relaxed text-muted-foreground">{fact.rationale}</p>
      )}
      {citation && (
        <a
          href={citation.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          ↗ {citation.title || new URL(citation.url).hostname}
        </a>
      )}
    </div>
  );
}
