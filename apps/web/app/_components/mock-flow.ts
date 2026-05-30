import type { AgentEvent, Run, StepId } from "@hahaton/contracts";

/**
 * Demo-safe mocked pipeline. Drives the live timeline with a scripted sequence
 * so the tool always looks like it's working — used as the automatic fallback
 * when the real /agent/stream errors, and as a forced demo mode (?demo=1).
 *
 * Driven by a chosen mock Run (random) so the timeline's sources match the
 * report that's then shown. Fully client-side — no API needed.
 */
interface MockStep {
  step: StepId;
  label: string;
  ms: number;
  search?: boolean;
}

const STEPS: MockStep[] = [
  { step: "brief", label: "Структурування ідеї", ms: 2200 },
  { step: "market", label: "Оцінка ринку (TAM/SAM/SOM)", ms: 3600, search: true },
  { step: "competitors", label: "Скан конкурентів", ms: 3400, search: true },
  { step: "canvas", label: "Бізнес-модель (Canvas)", ms: 2600 },
  { step: "gtm", label: "Go-to-market / 30-60-90", ms: 2600 },
  { step: "unitEconomics", label: "Юніт-економіка", ms: 2800 },
  { step: "risks", label: "Оцінка ризиків", ms: 2400 },
  { step: "synthesis", label: "Збірка пітчу", ms: 3000 },
  { step: "validation", label: "Multi-LLM валідація", ms: 3600 },
];

const QUERY: Partial<Record<StepId, string>> = {
  market: "оцінка розміру ринку (TAM/SAM/SOM)",
  competitors: "пошук конкурентів і їх позиціонування",
};

const now = () => new Date().toISOString();

/**
 * Plays the scripted timeline for `run`, calling `onEvent` for each event and
 * `onDone` when finished. Returns a cancel function (clears pending timers).
 */
export function playMockFlow(run: Run, onEvent: (e: AgentEvent) => void, onDone: () => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 0;
  const at = (delay: number, fn: () => void) => {
    t += delay;
    timers.push(setTimeout(fn, t));
  };
  const cites = run.citations ?? [];
  let citeIdx = 0;

  at(200, () => onEvent({ type: "run_started", runId: run.id, input: run.input, at: now() }));
  for (const s of STEPS) {
    at(300, () => onEvent({ type: "step_started", step: s.step, label: s.label, at: now() }));
    if (s.search) {
      const q = QUERY[s.step];
      if (q) at(s.ms * 0.4, () => onEvent({ type: "tool_call", step: s.step, tool: "web_search", query: q, at: now() }));
      const take = s.step === "market" ? 2 : 1;
      for (let i = 0; i < take; i++) {
        const c = cites[citeIdx++];
        if (c) at(s.ms * 0.25, () => onEvent({ type: "source_found", step: s.step, citation: c, at: now() }));
      }
    }
    at(s.ms * (s.search ? 0.35 : 1), () => onEvent({ type: "step_completed", step: s.step, at: now() }));
  }
  at(400, () => onEvent({ type: "run_completed", runId: run.id, at: now() }));
  at(700, onDone);

  return () => timers.forEach(clearTimeout);
}

/** Ukrainian labels for the live timeline, keyed by step id. */
export const STEP_LABELS: Record<StepId, string> = {
  brief: "Структурування ідеї",
  market: "Оцінка ринку",
  competitors: "Скан конкурентів",
  canvas: "Бізнес-модель",
  gtm: "Go-to-market",
  unitEconomics: "Юніт-економіка",
  risks: "Оцінка ризиків",
  synthesis: "Збірка пітчу",
  validation: "Multi-LLM валідація",
};

export const STEP_ORDER: StepId[] = STEPS.map((s) => s.step);
