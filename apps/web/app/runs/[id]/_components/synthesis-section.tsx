import type { PitchSynthesis } from "@hahaton/contracts";
import { EmptyState, SectionShell } from "./section-shell";

export function SynthesisSection({ synthesis }: { synthesis: PitchSynthesis | undefined }) {
  const hasAny =
    synthesis &&
    (synthesis.executiveSummary.trim() !== "" ||
      synthesis.narrative.trim() !== "" ||
      synthesis.deckOutline.length > 0);

  return (
    <SectionShell
      step="8 · synthesis"
      title="Pitch synthesis"
      description="Executive summary, narrative, and a deck outline ready to present."
    >
      {!synthesis || !hasAny ? (
        <EmptyState message="The pitch has not been synthesized yet." />
      ) : (
        <div className="flex flex-col gap-6">
          {synthesis.executiveSummary.trim() !== "" && (
            <div>
              <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Executive summary
              </h4>
              <p className="text-base leading-relaxed">{synthesis.executiveSummary}</p>
            </div>
          )}
          {synthesis.narrative.trim() !== "" && (
            <div>
              <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Narrative
              </h4>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                {synthesis.narrative}
              </p>
            </div>
          )}
          {synthesis.deckOutline.length > 0 && (
            <div>
              <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Deck outline
              </h4>
              <ol className="grid gap-3 sm:grid-cols-2">
                {synthesis.deckOutline.map((slide, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 p-3.5"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
                      <span className="text-sm font-semibold">{slide.slide}</span>
                    </div>
                    {slide.bullets.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-sm">
                        {slide.bullets.map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}
