import type { AgentEvent, StepId } from "@hahaton/contracts";

/**
 * Demo-safe mocked pipeline. Drives the live timeline with a scripted sequence
 * so the tool always looks like it's working — used as the automatic fallback
 * when the real /agent/stream errors, and as a forced demo mode (?demo=1).
 *
 * The fallback report is the seeded golden run (Ukrainian-ready), so the whole
 * flow stays solid on stage even if the LLM gateway / pipeline is down.
 */
export const FALLBACK_RUN_ID = "golden-dogfood";

interface MockStep {
  step: StepId;
  label: string;
  ms: number;
  query?: string;
  sources?: { title: string; url: string }[];
}

const STEPS: MockStep[] = [
  { step: "brief", label: "Структурування ідеї", ms: 2200 },
  { step: "market", label: "Оцінка ринку (TAM/SAM/SOM)", ms: 3600, query: "Europe pet food market size 2024",
    sources: [
      { title: "Europe Pet Food Market — Grand View Research", url: "https://www.grandviewresearch.com/industry-analysis/pet-food-market" },
      { title: "Poland Pet Ownership — Statista", url: "https://www.statista.com/statistics/poland-pet-ownership" },
    ] },
  { step: "competitors", label: "Скан конкурентів", ms: 3400, query: "fresh dog food subscription competitors EU",
    sources: [{ title: "Butternut Box — Crunchbase", url: "https://www.crunchbase.com/organization/butternut-box" }] },
  { step: "canvas", label: "Бізнес-модель (Canvas)", ms: 2600 },
  { step: "gtm", label: "Go-to-market / 30-60-90", ms: 2600 },
  { step: "unitEconomics", label: "Юніт-економіка", ms: 2800 },
  { step: "risks", label: "Оцінка ризиків", ms: 2400 },
  { step: "synthesis", label: "Збірка пітчу", ms: 3000 },
  { step: "validation", label: "Multi-LLM валідація", ms: 3600 },
];

const now = () => new Date().toISOString();

/**
 * Plays the scripted timeline, calling `onEvent` for each event and `onDone`
 * when finished. Returns a cancel function (clears pending timers).
 */
export function playMockFlow(onEvent: (e: AgentEvent) => void, onDone: () => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let t = 0;
  const at = (delay: number, fn: () => void) => {
    t += delay;
    timers.push(setTimeout(fn, t));
  };

  at(200, () => onEvent({ type: "run_started", runId: FALLBACK_RUN_ID, input: { idea: "" }, at: now() }));
  for (const s of STEPS) {
    at(300, () => onEvent({ type: "step_started", step: s.step, label: s.label, at: now() }));
    if (s.query) at(s.ms * 0.4, () => onEvent({ type: "tool_call", step: s.step, tool: "web_search", query: s.query as string, at: now() }));
    for (const src of s.sources ?? [])
      at(s.ms * 0.25, () => onEvent({ type: "source_found", step: s.step, citation: { id: src.url, url: src.url, title: src.title, accessedAt: now() }, at: now() }));
    at(s.ms * (s.query ? 0.35 : 1), () => onEvent({ type: "step_completed", step: s.step, at: now() }));
  }
  at(400, () => onEvent({ type: "run_completed", runId: FALLBACK_RUN_ID, at: now() }));
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
