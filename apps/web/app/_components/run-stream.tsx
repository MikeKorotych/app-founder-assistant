"use client";

import type { AgentEvent, Run } from "@hahaton/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@hahaton/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Game2048 } from "./game-2048";
import { LiveTimeline } from "./live-timeline";
import { playMockFlow } from "./mock-flow";
import { MOCK_RUN } from "./mock-run";
import { ReportBody } from "./report-body";

const LIVE_EVENTS = [
  "run_started",
  "step_started",
  "tool_call",
  "source_found",
  "step_completed",
  "run_completed",
  "error",
] as const;

function RestartIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
    </svg>
  );
}

/**
 * Drives the "analysing" view: tries the real SSE pipeline and, on ANY failure
 * (connection error, an error event, a failed run, or a watchdog timeout),
 * automatically falls back to the scripted mock flow so a demo never breaks.
 * `demo` forces the mock straight away (?demo=1).
 */
export function RunStream({
  idea,
  demo = false,
  onRestart,
}: {
  idea: string;
  demo?: boolean;
  onRestart?: () => void;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [mocked, setMocked] = useState(demo);
  const [report, setReport] = useState<Run | null>(null);

  const finished = useRef(false);
  const mockStarted = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const cancelMock = useRef<() => void>(() => {});

  useEffect(() => {
    const push = (e: AgentEvent) => setEvents((prev) => [...prev, e]);

    const goReport = (id: string) => {
      if (finished.current) return;
      finished.current = true;
      esRef.current?.close();
      router.push(`/runs/${id}`);
    };

    const finishMock = () => {
      if (finished.current) return;
      finished.current = true;
      esRef.current?.close();
      setReport(MOCK_RUN); // render the report client-side — needs no API
    };

    const startMock = () => {
      if (finished.current || mockStarted.current) return;
      mockStarted.current = true;
      esRef.current?.close();
      setMocked(true);
      setEvents([]); // replay the timeline cleanly from the mock
      cancelMock.current = playMockFlow(push, finishMock);
    };

    if (demo) {
      startMock();
      return () => cancelMock.current();
    }

    let es: EventSource;
    try {
      es = new EventSource(`/api/agent/stream?idea=${encodeURIComponent(idea)}`);
    } catch {
      startMock();
      return () => cancelMock.current();
    }
    esRef.current = es;

    for (const t of LIVE_EVENTS) {
      es.addEventListener(t, (ev) => {
        try {
          push(JSON.parse((ev as MessageEvent).data));
        } catch {}
        if (t === "error") startMock();
      });
    }
    es.addEventListener("run", (ev) => {
      try {
        const run = JSON.parse((ev as MessageEvent).data) as { id: string; status: string };
        if (run.status === "completed") goReport(run.id);
        else startMock();
      } catch {
        startMock();
      }
    });
    es.onerror = () => startMock();

    const watchdog = setTimeout(() => startMock(), 120_000);

    return () => {
      clearTimeout(watchdog);
      es.close();
      cancelMock.current();
    };
  }, [idea, demo, router]);

  if (report) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Звіт{mocked ? " · demo" : ""}
            </p>
            <p className="text-sm text-muted-foreground">{report.input.idea}</p>
          </div>
          <Button
            aria-label="Новий прогін"
            className="h-9 w-9 shrink-0 text-muted-foreground [&_svg]:size-5"
            onClick={() => {
              if (onRestart) onRestart();
              else router.push("/");
            }}
            size="icon"
            title="Новий прогін"
            type="button"
            variant="ghost"
          >
            <RestartIcon />
          </Button>
        </header>
        <ReportBody run={report} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Аналізуємо вашу ідею…</h1>
          {mocked && (
            <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              demo
            </span>
          )}
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{idea}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Хід роботи агента</CardTitle>
          </CardHeader>
          <CardContent>
            <LiveTimeline events={events} />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardHeader>
            <CardTitle className="text-base">Зіграйте, поки чекаєте</CardTitle>
          </CardHeader>
          <CardContent>
            <Game2048 />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
