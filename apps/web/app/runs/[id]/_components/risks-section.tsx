import type { Risk, RiskRegister } from "@hahaton/contracts";
import { EmptyState, SectionShell } from "./section-shell";

const LEVEL_STYLE: Record<Risk["likelihood"], string> = {
  low: "bg-muted/40 text-muted-foreground border-border/60",
  medium: "bg-secondary/40 text-secondary-foreground border-secondary/60",
  high: "bg-destructive/15 text-destructive border-destructive/30",
};

function LevelPill({ level }: { level: Risk["likelihood"] }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${LEVEL_STYLE[level]}`}
    >
      {level}
    </span>
  );
}

export function RisksSection({ register }: { register: RiskRegister | undefined }) {
  const risks = register?.risks ?? [];

  return (
    <SectionShell
      step="7 · risks"
      title="Risk register"
      description="Material risks with likelihood, impact, and a concrete mitigation."
    >
      {risks.length === 0 ? (
        <EmptyState message="No risks identified yet." />
      ) : (
        <div className="overflow-hidden rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Risk</th>
                <th className="px-3 py-2 text-left font-medium">Likelihood</th>
                <th className="px-3 py-2 text-left font-medium">Impact</th>
                <th className="px-3 py-2 text-left font-medium">Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r, i) => (
                <tr key={i} className="border-t border-border/60 align-top">
                  <td className="px-3 py-3 font-medium">{r.title}</td>
                  <td className="px-3 py-3">
                    <LevelPill level={r.likelihood} />
                  </td>
                  <td className="px-3 py-3">
                    <LevelPill level={r.impact} />
                  </td>
                  <td className="px-3 py-3 text-foreground/85">{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}
