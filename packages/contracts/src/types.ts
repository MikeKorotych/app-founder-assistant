/**
 * SHARED CONTRACT — the single source of truth for the agent pipeline.
 *
 * Freeze these shapes on kickoff. Every workstream (backend pipeline, SSE/persist,
 * unit-economics engine, UI) depends on them. Changing a type here = team sync, not a solo edit.
 *
 * Hard rule: every quantitative claim is a `Fact`. A Fact is EITHER grounded
 * (`citationId` points at a real source) OR an explicit estimate (`estimated: true`,
 * with the assumption stated in `rationale`). Never fabricate a citation.
 */

// ---------------------------------------------------------------------------
// Grounding primitives
// ---------------------------------------------------------------------------

/** A web source surfaced by the agent's research, deduped by URL. */
export interface Citation {
  /** Stable id referenced by Fact.citationId. */
  id: string;
  url: string;
  title: string;
  snippet?: string;
  /** ISO timestamp of when the source was fetched. */
  accessedAt: string;
}

/** A value that is either grounded in a citation or an explicit estimate. */
export interface Fact<T = number> {
  value: T;
  /** e.g. "USD", "EUR/mo", "%". */
  unit?: string;
  /** Why this value — for estimates, state the assumption explicitly. */
  rationale: string;
  /** Present when grounded in research. */
  citationId?: string;
  /** True when no source was found. Must coexist with a clear rationale. */
  estimated?: boolean;
}

// ---------------------------------------------------------------------------
// Step outputs (one per pipeline step)
// ---------------------------------------------------------------------------

/** Step 1 — normalized brief derived from the raw idea. */
export interface StructuredBrief {
  problem: string;
  customer: string;
  valueProp: string;
  geography: string;
  budget?: string;
  /** Concrete questions the research steps must answer. */
  researchQuestions: string[];
}

/** Step 2 — market sizing. Every figure is grounded or flagged estimated. */
export interface MarketSizing {
  method: "top-down" | "bottom-up";
  tam: Fact;
  sam: Fact;
  som: Fact;
  notes?: string;
}

export interface Competitor {
  name: string;
  positioning: string;
  pricing?: Fact<string>;
  funding?: Fact<string>;
  url?: string;
  citationId?: string;
}

/** Step 3 — competitor scan. */
export interface CompetitorScan {
  competitors: Competitor[];
}

/** Step 4 — Business Model Canvas (9 blocks). */
export interface BusinessModelCanvas {
  customerSegments: string[];
  valuePropositions: string[];
  channels: string[];
  customerRelationships: string[];
  revenueStreams: string[];
  keyResources: string[];
  keyActivities: string[];
  keyPartnerships: string[];
  costStructure: string[];
}

/** Step 5 — go-to-market / first 90 days. */
export interface GtmPlan {
  channels: string[];
  plan30: string[];
  plan60: string[];
  plan90: string[];
  hypotheses: string[];
}

/**
 * Step 6 — unit-economics ASSUMPTIONS only. The LLM produces these; the math
 * lives in `computeUnitEconomics` (pure TS), never in the model.
 */
export interface Assumptions {
  /** Average revenue per user, per month. */
  arpu: Fact;
  /** Gross margin, 0..100. */
  grossMarginPct: Fact;
  /** Customer acquisition cost. */
  cac: Fact;
  /** Monthly churn, 0..100. */
  monthlyChurnPct: Fact;
  /** Funnel conversion to paying, 0..100. */
  conversionPct: Fact;
  /** Fixed monthly cost (overhead). */
  fixedMonthlyCost: Fact;
  /** Monthly top-of-funnel volume. */
  funnelVolume: Fact;
}

/** Derived metrics — output of `computeUnitEconomics`, NOT produced by the LLM. */
export interface UnitEconomics {
  /** Lifetime value per customer. */
  ltv: number;
  ltvCacRatio: number;
  paybackMonths: number;
  /** Monthly gross contribution per customer (arpu * margin). */
  contributionPerCustomer: number;
  /** Paying customers needed for monthly gross profit to cover fixed cost. */
  breakEvenCustomers: number;
  /** Rough early-stage monthly cash burn at steady acquisition. */
  monthlyBurn: number;
  /** Human-readable sanity warnings (e.g. LTV:CAC below 3). */
  warnings: string[];
}

export interface Risk {
  title: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation: string;
}

/** Step 7 — risk register. */
export interface RiskRegister {
  risks: Risk[];
}

export interface DeckSlide {
  slide: string;
  bullets: string[];
}

/** Step 8 — synthesis into a pitch narrative + deck outline. */
export interface PitchSynthesis {
  executiveSummary: string;
  narrative: string;
  deckOutline: DeckSlide[];
}

// ---------------------------------------------------------------------------
// Run + streaming events
// ---------------------------------------------------------------------------

export type StepId =
  | "brief"
  | "market"
  | "competitors"
  | "canvas"
  | "gtm"
  | "unitEconomics"
  | "risks"
  | "synthesis";

export interface RunInput {
  idea: string;
  region?: string;
  budget?: string;
}

/**
 * The accumulated state of one analysis. Persisted to disk so a completed run
 * replays instantly on stage (the demo safety net).
 */
export interface Run {
  id: string;
  input: RunInput;
  createdAt: string;
  status: "running" | "completed" | "failed";

  brief?: StructuredBrief;
  market?: MarketSizing;
  competitors?: CompetitorScan;
  canvas?: BusinessModelCanvas;
  gtm?: GtmPlan;
  /** LLM-produced assumptions; derived metrics are computed client/server-side on the fly. */
  assumptions?: Assumptions;
  risks?: RiskRegister;
  synthesis?: PitchSynthesis;

  /** All sources, deduped by URL, referenced by Fact.citationId. */
  citations: Citation[];
  /** Full event log for instant replay. */
  events: AgentEvent[];
}

/** Streaming events emitted over SSE and persisted for replay. */
export type AgentEvent =
  | { type: "run_started"; runId: string; input: RunInput; at: string }
  | { type: "step_started"; step: StepId; label: string; at: string }
  | { type: "tool_call"; step: StepId; tool: "web_search"; query: string; at: string }
  | { type: "source_found"; step: StepId; citation: Citation; at: string }
  | { type: "step_completed"; step: StepId; at: string }
  | { type: "run_completed"; runId: string; at: string }
  | { type: "error"; step?: StepId; message: string; at: string };
