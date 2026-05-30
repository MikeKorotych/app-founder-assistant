import type Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent, Fact, Run, StepId } from "../../shared/types.js";

/**
 * Shared context every step receives. A step reads prior outputs from `run`,
 * does its work (LLM call + optional web_search), emits progress events, and
 * writes its typed output back onto `run`.
 */
export interface StepContext {
  run: Run;
  client: Anthropic;
  emit: (e: AgentEvent) => void;
}

export type StepFn = (ctx: StepContext) => Promise<void>;

const nowIso = () => new Date().toISOString();

/** Placeholder estimated Fact for scaffolding — replace when the step is implemented. */
const todoFact = (rationale: string, unit?: string): Fact => ({
  value: 0,
  unit,
  rationale: `TODO: ${rationale}`,
  estimated: true,
});

/**
 * Wraps a step body with start/complete events and error reporting, so each
 * step file only implements the actual work.
 */
function step(id: StepId, label: string, body: StepFn): StepFn {
  return async (ctx) => {
    ctx.emit({ type: "step_started", step: id, label, at: nowIso() });
    try {
      await body(ctx);
      ctx.emit({ type: "step_completed", step: id, at: nowIso() });
    } catch (err) {
      ctx.emit({
        type: "error",
        step: id,
        message: err instanceof Error ? err.message : String(err),
        at: nowIso(),
      });
      throw err;
    }
  };
}

// ---------------------------------------------------------------------------
// Step stubs — typed placeholders so the UI can build against real shapes now.
// Each TODO is one workstream-A task: add the prompt + web_search config and
// map the model output (validated) onto `ctx.run.<field>`.
// MODEL hints: market/unitEconomics/synthesis → Opus; rest → Sonnet; utils → Haiku.
// ---------------------------------------------------------------------------

/** Step 1 — Sonnet. Normalize the raw idea into a structured brief. */
export const briefStep = step("brief", "Structuring the idea", async (ctx) => {
  // TODO: LLM call → StructuredBrief. No web_search.
  ctx.run.brief = {
    problem: "",
    customer: "",
    valueProp: "",
    geography: ctx.run.input.region ?? "",
    budget: ctx.run.input.budget,
    researchQuestions: [],
  };
});

/** Step 2 — Opus + web_search. Size the market; every figure grounded or estimated. */
export const marketStep = step("market", "Sizing the market", async (ctx) => {
  // TODO: LLM call WITH web_search. Push found Citations to ctx.run.citations and
  // emit source_found / tool_call events. Tie each Fact to a citationId.
  ctx.run.market = {
    method: "top-down",
    tam: todoFact("size TAM via web research", "USD"),
    sam: todoFact("derive SAM", "USD"),
    som: todoFact("derive SOM", "USD"),
  };
});

/** Step 3 — Sonnet + web_search. Find real competitors. */
export const competitorsStep = step("competitors", "Scanning competitors", async (ctx) => {
  // TODO: LLM call WITH web_search → 4-8 competitors with sources.
  ctx.run.competitors = { competitors: [] };
});

/** Step 4 — Sonnet. Business Model Canvas (uses brief + market). */
export const canvasStep = step("canvas", "Building the business model", async (ctx) => {
  // TODO: LLM call → 9 canvas blocks. No web_search.
  ctx.run.canvas = {
    customerSegments: [],
    valuePropositions: [],
    channels: [],
    customerRelationships: [],
    revenueStreams: [],
    keyResources: [],
    keyActivities: [],
    keyPartnerships: [],
    costStructure: [],
  };
});

/** Step 5 — Sonnet. GTM / first 90 days. */
export const gtmStep = step("gtm", "Planning go-to-market", async (ctx) => {
  // TODO: LLM call → channels + 30/60/90 plan + hypotheses.
  ctx.run.gtm = { channels: [], plan30: [], plan60: [], plan90: [], hypotheses: [] };
});

/** Step 6 — Opus. Produce unit-economics ASSUMPTIONS only (math lives in computeUnitEconomics). */
export const unitEconomicsStep = step("unitEconomics", "Modeling unit economics", async (ctx) => {
  // TODO: LLM call → Assumptions, each field grounded or estimated.
  ctx.run.assumptions = {
    arpu: todoFact("estimate ARPU", "USD/mo"),
    grossMarginPct: todoFact("estimate gross margin", "%"),
    cac: todoFact("estimate CAC", "USD"),
    monthlyChurnPct: todoFact("estimate monthly churn", "%"),
    conversionPct: todoFact("estimate funnel conversion", "%"),
    fixedMonthlyCost: todoFact("estimate fixed monthly cost", "USD"),
    funnelVolume: todoFact("estimate monthly funnel volume", "users"),
  };
});

/** Step 7 — Sonnet. Risk register. */
export const risksStep = step("risks", "Assessing risks", async (ctx) => {
  // TODO: LLM call → risks with likelihood/impact/mitigation.
  ctx.run.risks = { risks: [] };
});

/** Step 8 — Opus. Synthesize the narrative + deck outline from everything above. */
export const synthesisStep = step("synthesis", "Assembling the pitch", async (ctx) => {
  // TODO: LLM call → executive summary, narrative, deck outline.
  ctx.run.synthesis = { executiveSummary: "", narrative: "", deckOutline: [] };
});
