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

function StepDot({ status }: { status: StepStatus }) {
  if (status === "done")
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/20 ring-1 ring-teal-500/60">
        <svg className="h-3.5 w-3.5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  if (status === "error")
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/20 ring-1 ring-destructive/60">
        <span className="text-xs font-bold text-destructive">!</span>
      </div>
    );
  if (status === "active")
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/10 ring-1 ring-teal-500">
        <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-teal-400 border-t-transparent" />
      </div>
    );
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-border/40">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
    </div>
  );
}

export function LiveTimeline({ events }: { events: AgentEvent[] }) {
  const steps = derive(events);
  return (
    <ol className="flex flex-col">
      {STEP_ORDER.map((id, i) => {
        const v = steps[id];
        const isLast = i === STEP_ORDER.length - 1;
        const labelColor =
          v.status === "done" ? "text-foreground" :
          v.status === "active" ? "text-foreground font-medium" :
          v.status === "error" ? "text-destructive" :
          "text-muted-foreground/50";

        return (
          <li key={id} className="flex gap-3">
            {/* Left: dot + connector line */}
            <div className="flex flex-none flex-col items-center">
              <StepDot status={v.status} />
              {!isLast && (
                <div
                  className={`mt-1 w-px flex-1 min-h-[1rem] transition-colors duration-500 ${
                    v.status === "done" ? "bg-teal-500/40" : "bg-border/30"
                  }`}
                />
              )}
            </div>

            {/* Right: content */}
            <div className={`flex flex-col gap-1 pb-4 ${isLast ? "pb-0" : ""}`}>
              <div className="flex items-baseline gap-1.5 pt-0.5">
                <span className="font-mono text-[10px] text-muted-foreground/40">{i + 1}</span>
                <span className={`text-sm ${labelColor}`}>{STEP_LABELS[id]}</span>
              </div>
              {v.queries.map((q, j) => (
                <span key={j} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                  {q}
                </span>
              ))}
              {v.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {v.sources.map((s, j) => (
                    <a
                      key={j}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-teal-500/30 bg-teal-500/5 px-1.5 py-0.5 text-[10px] text-teal-400/80 underline decoration-dotted underline-offset-2 hover:text-teal-300"
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
