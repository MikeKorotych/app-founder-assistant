"use client";

import type { AgentEvent, StepId } from "@hahaton/contracts";
import { STEP_LABELS, STEP_ORDER } from "./mock-flow";

type StepStatus = "pending" | "active" | "done" | "error";

interface StepView {
  status: StepStatus;
  queries: string[];
  sources: { title: string; url: string }[];
}

function derive(events: AgentEvent[]): Record<StepId, StepView> {
  const map = {} as Record<StepId, StepView>;
  for (const s of STEP_ORDER) map[s] = { status: "pending", queries: [], sources: [] };
  for (const e of events) {
    if (e.type === "step_started" && map[e.step]) map[e.step].status = "active";
    else if (e.type === "step_completed" && map[e.step] && map[e.step].status !== "error") map[e.step].status = "done";
    else if (e.type === "tool_call" && map[e.step]) map[e.step].queries.push(e.query);
    else if (e.type === "source_found" && map[e.step]) map[e.step].sources.push({ title: e.citation.title, url: e.citation.url });
    else if (e.type === "error" && e.step && map[e.step]) map[e.step].status = "error";
  }
  return map;
}

function Icon({ status }: { status: StepStatus }) {
  if (status === "done") return <span className="text-foreground">✓</span>;
  if (status === "error") return <span className="text-destructive">!</span>;
  if (status === "active")
    return <span className="inline-block h-3 w-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />;
  return <span className="text-faint/60 text-muted-foreground/40">○</span>;
}

export function LiveTimeline({ events }: { events: AgentEvent[] }) {
  const steps = derive(events);
  return (
    <ol className="flex flex-col gap-2.5">
      {STEP_ORDER.map((id, i) => {
        const v = steps[id];
        return (
          <li key={id} className="flex gap-3">
            <div className="flex w-4 flex-none justify-center pt-0.5 text-xs">
              <Icon status={v.status} />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-muted-foreground/60">{i + 1}</span>
                <span
                  className={`text-sm ${v.status === "done" ? "text-foreground" : v.status === "active" ? "text-foreground" : v.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {STEP_LABELS[id]}
                </span>
              </div>
              {v.queries.map((q, j) => (
                <span key={j} className="text-[11px] text-muted-foreground">🔎 {q}</span>
              ))}
              {v.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {v.sources.map((s, j) => (
                    <a
                      key={j}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
                    >
                      ↗ {s.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
