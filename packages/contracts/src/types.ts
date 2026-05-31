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
// Step 9 — Multi-LLM validation panel
// ---------------------------------------------------------------------------

/** Scores for one validation persona across 4 categories, each 0–25. */
export interface ValidationScore {
  /** Problem × Market: is the pain real? TAM/ICP confirmed? */
  problemMarket: number;
  /** Solution × Differentiation: unique? defensible? */
  solutionDiff: number;
  /** Business Model × Unit Economics: LTV/CAC viable? path to breakeven? */
  businessModel: number;
  /** GTM × First Traction: clear channel? early signals? */
  gtmTraction: number;
}

export type ValidationPersona = "skeptic" | "advocate" | "analyst";

export interface ValidationPersonaResult {
  persona: ValidationPersona;
  scores: ValidationScore;
  /** Total out of 100 */
  total: number;
  /** Key reasoning per category — shown in UI alongside scores */
  rationale: Record<keyof ValidationScore, string>;
}

export interface ValidationResult {
  personas: ValidationPersonaResult[];
  /** Averaged scores across all 3 personas */
  consensus: ValidationScore;
  /** Averaged total /100 */
  totalScore: number;
  /**
   * Categories where spread between persona scores > 5 pts.
   * These are flagged as key risks / CustDev questions.
   */
  disagreements: Array<{
    category: keyof ValidationScore;
    min: number;
    max: number;
    /** Concrete CustDev question to answer before pitching */
    custDevQuestion: string;
  }>;
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
  | "synthesis"
  | "validation";

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
  /** Step 9 — Multi-LLM validation panel result. */
  validation?: ValidationResult;

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
  | {
      type: "error";
      step?: StepId;
      message: string;
      /** OutboundErrorKind value (e.g. "auth", "rate-limit", "transport"), when known. */
      kind?: string;
      /** Whether the failed call is worth retrying, when known. */
      retryable?: boolean;
      at: string;
    };

// ---------------------------------------------------------------------------
// Search-intent expansion (raw UI query → keywords + categories for fan-out)
// ---------------------------------------------------------------------------

/** Raw search query coming from the UI. */
export interface SearchIntentInput {
  /** The user's free-text search query. */
  query: string;
  /** Optional BCP-47 locale hint, e.g. "uk", "en-US". */
  locale?: string;
}

/**
 * Expanded search intent — the comprehensive set of terms and categories the
 * LLM derives from a raw query, used to fan out searches across services.
 */
export interface SearchIntent {
  /** Deduplicated search terms: core terms, synonyms, long-tail, related, entities. */
  keywords: string[];
  /** Taxonomy/category labels the query relates to. */
  categories: string[];
}

/**
 * A persisted search-intent expansion: the raw query plus its derived
 * `SearchIntent`, with an id + timestamp. Stored so the UI can show what was
 * queried and downstream services (scout) can fan out from the same id.
 */
export interface SearchExpansion extends SearchIntent {
  id: string;
  /** The raw query the user submitted from the UI. */
  query: string;
  /** Optional BCP-47 locale the expansion was run for. */
  locale?: string;
  /** ISO timestamp of when the expansion was created. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Opportunity Radar — post-Scout review mining
//
// Pipeline: Scout competitors → fetch their store reviews → classify each
// review into signals → cluster recurring themes → synthesize an
// OpportunityReport. The report is a DECISION MAP ("what to test first"),
// never a verdict ("good/bad idea"). Sample size is surfaced for honesty.
// ---------------------------------------------------------------------------

/** A single user review/comment fetched from a competitor's store listing. */
export interface Review {
  /** Stable id, unique within the run (e.g. `${competitorId}#${n}` or the source review id). */
  id: string;
  /** The competitor (RawCompetitor.id) this review belongs to. */
  competitorId: string;
  /** Source the review came from: "itunes" | "googleplay" | "producthunt" | ... */
  source: string;
  /** Star rating 1–5 where the source exposes it. */
  rating?: number;
  title?: string;
  body: string;
  author?: string;
  /** ISO date when the review was posted, when available. */
  at?: string;
}

/** The signal taxonomy a review can be classified into. */
export type ReviewSignalKind =
  | "pain" // a complaint / unmet need
  | "praised_feature" // something users explicitly love
  | "missing_feature" // a feature users ask for / wish existed
  | "pricing_issue" // paywall, too expensive, bad value
  | "ux_issue" // confusing / clunky interface
  | "reliability_bug" // crashes, sync loss, broken behaviour
  | "onboarding_confusion" // first-run / setup friction
  | "switching_reason" // why they left / would leave a product
  | "audience_hint"; // a clue about who the user is

/** One classified signal extracted from a review by the LLM classifier. */
export interface ReviewSignal {
  /** Which review this came from (Review.id). */
  reviewId: string;
  /** Which competitor the review was about (RawCompetitor.id). */
  competitorId: string;
  kind: ReviewSignalKind;
  /** Short normalized theme phrase (the model's summary of the signal). */
  theme: string;
  /** Optional supporting verbatim quote from the review. */
  quote?: string;
  /** The review's star rating, when known — lets pains from 1–2★ be weighted. */
  rating?: number;
}

/** A recurring theme — many signals of the same kind rolled together. */
export interface ReviewCluster {
  kind: ReviewSignalKind;
  /** Human-readable label for the recurring theme. */
  label: string;
  /** How many signals rolled into this cluster (its strength). */
  count: number;
  /** A few representative verbatim quotes. */
  examples: string[];
}

/**
 * Opportunity Radar — the decision map produced from competitor reviews.
 * Every field is grounded in the mined signals; it answers "what to test
 * first", not "is the idea good".
 */
export interface OpportunityReport {
  /** Strongest recurring pains (sorted by strength). */
  topPains: ReviewCluster[];
  /** Features users repeatedly praise. */
  loved: ReviewCluster[];
  /** Distilled reasons behind 1–2★ ratings. */
  oneTwoStarReasons: string[];
  /** Where the market looks crowded / "red zone". */
  saturation: string;
  /** The unfilled niche / window of opportunity. */
  opportunityGap: string;
  /** The narrow first ICP worth targeting. */
  firstIcp: string;
  /** How this idea could meaningfully differentiate. */
  differentiation: string;
  /** A concrete experiment to run in 7 days. */
  sevenDayTest: string;
  /** Kill criterion — the result at which the idea should be dropped. */
  killCriterion: string;
  /** Total reviews the report is based on (honesty about sample size). */
  reviewsAnalyzed: number;
  /** Per-source review counts for transparency. */
  sources: Array<{ source: string; reviews: number }>;
}

/**
 * A per-competitor profile for the Competitive Landscape block — the at-a-glance
 * picture of one rival. Quantitative fields are real where the store exposes
 * them (reviews, rating, launch date) or clearly estimated (installs); the
 * qualitative fields are synthesized from that competitor's own reviews.
 */
export interface CompetitorProfile {
  /** RawCompetitor.id this profile is for. */
  competitorId: string;
  name: string;
  source: string;
  url?: string;
  /** Real review count from the store listing. */
  reviewCount: number;
  /** Real average rating (1–5), when known. */
  rating?: number;
  /** Estimated monthly installs — no paid API, so flagged as an estimate in UI. */
  estimatedInstalls?: number;
  /** ISO launch date where the source exposes it (Product Hunt etc.). */
  launchedAt?: string;
  /** How many of this competitor's reviews fed the synthesis. */
  reviewsAnalyzed: number;
  /** General theme of the POSITIVE reviews. */
  positiveTheme: string;
  /** General theme of the NEGATIVE reviews. */
  negativeTheme: string;
  strengths: string[];
  weaknesses: string[];
  /** The product's distinctive angle — its "изюминка". */
  hook: string;
  /** What a founder could be inspired by here. */
  inspiration: string;
  /** What to avoid / not repeat from this competitor. */
  avoid: string;
}

// ---------------------------------------------------------------------------
// Global Niche Radar — cross-country "localized winner" discovery
//
// Scan App Store top charts for the niche across many countries, then surface
// apps that rank/rise in some markets but are (near-)absent in the founder's
// home market — geo-arbitrage signals. Growth-over-time needs paid APIs and is
// deferred; "new + high in chart" is the rising proxy. Honest about coverage.
// ---------------------------------------------------------------------------

/** One app's position on a single country's App Store chart. */
export interface ChartApp {
  /** iTunes app id (store-unique). */
  appId: string;
  name: string;
  url?: string;
  artist?: string;
  /** 1-based position in that country's chart. */
  rank: number;
  /** ISO country code the chart was fetched for. */
  country: string;
}

/**
 * A localized winner: charts in one or a few markets, (near-)absent in the
 * founder's home market. The geo-arbitrage opportunity.
 */
export interface GlobalRadarEntry {
  appId: string;
  name: string;
  url?: string;
  /** Markets where it charts, best rank first. */
  markets: Array<{ country: string; rank: number }>;
  /** Best (lowest) rank across all markets. */
  bestRank: number;
  /** How many country charts it appears in. */
  marketCount: number;
  /** True when it does NOT appear in the home-market chart. */
  absentAtHome: boolean;
  /** LLM enrichment — what the app appears to do + why it works (optional). */
  whatItDoes?: string;
  /** LLM enrichment — the takeaway / what a founder could port (optional). */
  takeaway?: string;
}

/** The Global Niche Radar result — localized winners across scanned markets. */
export interface GlobalNicheRadar {
  /** The founder's home market (apps charting here are NOT "undiscovered"). */
  homeCountry: string;
  /** Human label for the App Store genre scanned, when resolved. */
  genreLabel?: string;
  /** ISO country codes actually scanned. */
  countriesScanned: string[];
  /** Localized winners, strongest signal first. */
  entries: GlobalRadarEntry[];
}

// ---------------------------------------------------------------------------
// Global Digest (M6) — the recurring "what's rising worldwide" snapshot
//
// Produced on a schedule (Cloudflare Cron) from App Store "top new" charts
// across many countries: apps with cross-market momentum. Persisted to D1 so
// the UI shows the latest snapshot and (later) how it changes over time.
// ---------------------------------------------------------------------------

/** One app in the global digest, with the markets it's rising in. */
export interface DigestApp {
  appId: string;
  name: string;
  url?: string;
  /** Markets where it charts in the "new/rising" feed, best rank first. */
  markets: Array<{ country: string; rank: number }>;
  /** How many country charts it appears in (momentum breadth). */
  marketCount: number;
  /** Best (lowest) rank across markets. */
  bestRank: number;
  /** Optional LLM one-liner: what it is / why it's rising. */
  note?: string;
}

/** A persisted snapshot of globally-rising new apps. */
export interface GlobalDigest {
  id: string;
  /** ISO timestamp the digest was generated. */
  createdAt: string;
  /** ISO country codes scanned. */
  countriesScanned: string[];
  /** Apps rising across the most markets, strongest momentum first. */
  globalRisers: DigestApp[];
  /** Optional LLM summary of the movement in this snapshot. */
  summary?: string;
}
