import type { StructuredBrief } from "@hahaton/contracts";
import { EmptyState, SectionShell } from "./section-shell";

function hasContent(brief: StructuredBrief): boolean {
  return (
    brief.problem.trim() !== "" ||
    brief.customer.trim() !== "" ||
    brief.valueProp.trim() !== "" ||
    brief.researchQuestions.length > 0
  );
}

function Field({ label, value }: { label: string; value: string | undefined }) {
  if (!value || value.trim() === "") return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <span className="text-sm leading-relaxed">{value}</span>
    </div>
  );
}

export function BriefSection({ brief }: { brief: StructuredBrief | undefined }) {
  return (
    <SectionShell step="1 · brief" title="Structured brief" description="The idea normalized into the questions the rest of the pipeline must answer.">
      {!brief || !hasContent(brief) ? (
        <EmptyState message="The agent has not produced a structured brief yet." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Problem" value={brief.problem} />
          <Field label="Customer" value={brief.customer} />
          <Field label="Value proposition" value={brief.valueProp} />
          <Field label="Geography" value={brief.geography} />
          {brief.budget && <Field label="Budget" value={brief.budget} />}
          {brief.researchQuestions.length > 0 && (
            <div className="sm:col-span-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Research questions
              </span>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
                {brief.researchQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </SectionShell>
  );
}
