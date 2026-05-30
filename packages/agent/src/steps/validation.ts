/**
 * Step 9 — Multi-LLM Validation Panel.
 *
 * Three personas (Skeptic, Advocate, Neutral Analyst) score the idea across
 * 4 categories (×25 → /100) in parallel. A synthesiser then averages scores
 * and flags categories where the spread > 5 pts as CustDev risks.
 *
 * Personas run with MODELS.sonnet (fast, cheap). Each receives the full
 * grounded research context built by steps 1–8 so scores are evidence-based,
 * not hallucinated.
 */

import type {
  ValidationPersona,
  ValidationPersonaResult,
  ValidationResult,
  ValidationScore,
} from "@hahaton/contracts";
import { MODELS } from "@hahaton/llm";
import type { StepContext } from "./index";

// ---------------------------------------------------------------------------
// Context builder — serialises the grounded research into a single block
// that all three personas receive via prompt caching.
// ---------------------------------------------------------------------------

function buildResearchContext(ctx: StepContext): string {
  const { run } = ctx;
  const lines: string[] = ["=== GROUNDED RESEARCH CONTEXT ===\n"];

  if (run.brief) {
    lines.push(`PROBLEM: ${run.brief.problem}`);
    lines.push(`CUSTOMER: ${run.brief.customer}`);
    lines.push(`VALUE PROP: ${run.brief.valueProp}`);
    lines.push(`GEOGRAPHY: ${run.brief.geography}`);
    if (run.brief.budget) lines.push(`BUDGET: ${run.brief.budget}`);
  }

  if (run.market) {
    lines.push(`\nMARKET SIZING (${run.market.method}):`);
    lines.push(`  TAM: ${run.market.tam.value} ${run.market.tam.unit ?? ""} — ${run.market.tam.rationale}`);
    lines.push(`  SAM: ${run.market.sam.value} ${run.market.sam.unit ?? ""} — ${run.market.sam.rationale}`);
    lines.push(`  SOM: ${run.market.som.value} ${run.market.som.unit ?? ""} — ${run.market.som.rationale}`);
  }

  if (run.competitors?.competitors.length) {
    lines.push(`\nCOMPETITORS (${run.competitors.competitors.length}):`);
    for (const c of run.competitors.competitors.slice(0, 6)) {
      lines.push(`  • ${c.name}: ${c.positioning}${c.pricing ? ` | price: ${c.pricing.value}` : ""}`);
    }
  }

  if (run.canvas) {
    lines.push(`\nBUSINESS MODEL CANVAS:`);
    lines.push(`  Revenue streams: ${run.canvas.revenueStreams.join(", ")}`);
    lines.push(`  Customer segments: ${run.canvas.customerSegments.join(", ")}`);
    lines.push(`  Channels: ${run.canvas.channels.join(", ")}`);
  }

  if (run.gtm) {
    lines.push(`\nGTM — FIRST 30 DAYS: ${run.gtm.plan30.join("; ")}`);
    lines.push(`GTM CHANNELS: ${run.gtm.channels.join(", ")}`);
  }

  if (run.assumptions) {
    const a = run.assumptions;
    lines.push(`\nUNIT ECONOMICS ASSUMPTIONS:`);
    lines.push(`  ARPU: ${a.arpu.value} ${a.arpu.unit} — ${a.arpu.rationale}`);
    lines.push(`  Gross margin: ${a.grossMarginPct.value}% — ${a.grossMarginPct.rationale}`);
    lines.push(`  CAC: ${a.cac.value} ${a.cac.unit} — ${a.cac.rationale}`);
    lines.push(`  Monthly churn: ${a.monthlyChurnPct.value}% — ${a.monthlyChurnPct.rationale}`);
    lines.push(`  CAC payback: derived from above`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Persona system prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS: Record<ValidationPersona, string> = {
  skeptic: `You are a veteran venture capital investor known for brutal honesty.
Your job is to stress-test a business idea and find every hole before a founder embarrasses themselves in front of real investors.

You score ideas across 4 categories (0–25 each, total /100):
1. problemMarket — Is the pain REAL and LARGE? Is the ICP proven, not assumed? Is TAM credible with cited sources?
2. solutionDiff   — Is the solution meaningfully different from existing alternatives? Does it have a defensible moat?
3. businessModel  — Do the unit economics actually work? Is LTV:CAC ≥ 3? Is there a clear path to breakeven?
4. gtmTraction    — Is the go-to-market specific and executable? Are there early demand signals, not wishful thinking?

Be harsh but fair. Low scores are fine if the evidence is weak. Do NOT give credit for potential — only for evidence.

Respond ONLY with valid JSON in this exact shape:
{
  "scores": {
    "problemMarket": <0-25>,
    "solutionDiff": <0-25>,
    "businessModel": <0-25>,
    "gtmTraction": <0-25>
  },
  "rationale": {
    "problemMarket": "<1-2 sentences citing specific evidence or lack thereof>",
    "solutionDiff": "<1-2 sentences>",
    "businessModel": "<1-2 sentences>",
    "gtmTraction": "<1-2 sentences>"
  }
}`,

  advocate: `You are an experienced startup operator and mentor who has helped dozens of companies find product-market fit.
Your job is to build the strongest possible case for why this idea could succeed, based strictly on the provided evidence.

You score ideas across 4 categories (0–25 each, total /100):
1. problemMarket — How urgent and widespread is the pain? How big is the addressable market? How clear is the ICP?
2. solutionDiff   — What is the unfair advantage? What makes this solution genuinely better than alternatives?
3. businessModel  — What is the most promising monetisation path? What do the unit economics suggest about scalability?
4. gtmTraction    — What channels have proven traction for similar products? What first customers are within reach?

Be optimistic but grounded — base your scores on the evidence provided, not on blind optimism.
High scores must be justified by specific data points in the context.

Respond ONLY with valid JSON in this exact shape:
{
  "scores": {
    "problemMarket": <0-25>,
    "solutionDiff": <0-25>,
    "businessModel": <0-25>,
    "gtmTraction": <0-25>
  },
  "rationale": {
    "problemMarket": "<1-2 sentences citing specific evidence>",
    "solutionDiff": "<1-2 sentences>",
    "businessModel": "<1-2 sentences>",
    "gtmTraction": "<1-2 sentences>"
  }
}`,

  analyst: `You are a neutral market analyst. Your job is to assess a business idea objectively using the provided research data.
You have no emotional attachment to the idea — your goal is an accurate, evidence-based evaluation.

You score ideas across 4 categories (0–25 each, total /100):
1. problemMarket — Assess problem severity (frequency, intensity, willingness to pay) and market size credibility.
2. solutionDiff   — Assess competitive differentiation against the identified competitors. Is the moat real?
3. businessModel  — Assess unit-economics viability: LTV/CAC ratio, payback period, path to cash-flow positive.
4. gtmTraction    — Assess go-to-market realism: channel specificity, CAC achievability, first-customer clarity.

Base every score strictly on the research provided. Where data is missing or estimated, flag it in the rationale.
Avoid both excessive optimism and excessive pessimism.

Respond ONLY with valid JSON in this exact shape:
{
  "scores": {
    "problemMarket": <0-25>,
    "solutionDiff": <0-25>,
    "businessModel": <0-25>,
    "gtmTraction": <0-25>
  },
  "rationale": {
    "problemMarket": "<1-2 sentences>",
    "solutionDiff": "<1-2 sentences>",
    "businessModel": "<1-2 sentences>",
    "gtmTraction": "<1-2 sentences>"
  }
}`,
};

// ---------------------------------------------------------------------------
// Per-persona LLM call
// ---------------------------------------------------------------------------

async function scoreIdea(
  ctx: StepContext,
  persona: ValidationPersona,
  researchContext: string,
): Promise<ValidationPersonaResult> {
  const response = await ctx.llm.chat({
    model: MODELS.sonnet,
    maxTokens: 600,
    temperature: 0.3, // low temp for consistent scoring
    messages: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: SYSTEM_PROMPTS[persona],
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            // Cache the shared research context across all 3 persona calls
            type: "text",
            text: researchContext,
            cacheControl: { ttl: "5m" },
          },
          {
            type: "text",
            text: `\nIdea: "${ctx.run.input.idea}"\n\nScore this idea now.`,
          },
        ],
      },
    ],
  });

  const raw = response.content ?? "";

  // Extract JSON from the response (model sometimes wraps it in markdown)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`[validation:${persona}] No JSON in response: ${raw.slice(0, 200)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    scores: ValidationScore;
    rationale: Record<keyof ValidationScore, string>;
  };

  // Clamp all scores to [0, 25]
  const clamp = (v: unknown) => Math.min(25, Math.max(0, Number(v) || 0));
  const scores: ValidationScore = {
    problemMarket: clamp(parsed.scores.problemMarket),
    solutionDiff: clamp(parsed.scores.solutionDiff),
    businessModel: clamp(parsed.scores.businessModel),
    gtmTraction: clamp(parsed.scores.gtmTraction),
  };

  const total = scores.problemMarket + scores.solutionDiff + scores.businessModel + scores.gtmTraction;

  return { persona, scores, total, rationale: parsed.rationale };
}

// ---------------------------------------------------------------------------
// Synthesiser — averages + flags disagreements
// ---------------------------------------------------------------------------

const CUSD_DEV_QUESTIONS: Record<keyof ValidationScore, string> = {
  problemMarket:
    "Have you spoken to ≥10 potential customers? Can you name 3 who said they would pay for this today?",
  solutionDiff:
    "Why would a customer switch from their current solution to yours? What makes it 10× better, not just marginally better?",
  businessModel:
    "What is your realistic CAC from your first acquisition channel? Does LTV ÷ CAC exceed 3 within 12 months?",
  gtmTraction:
    "Who is your first paying customer and how will you get them in the next 30 days?",
};

function synthesise(personas: ValidationPersonaResult[]): ValidationResult {
  const cats = ["problemMarket", "solutionDiff", "businessModel", "gtmTraction"] as const;

  const consensus = Object.fromEntries(
    cats.map((cat) => [
      cat,
      Math.round(personas.reduce((sum, p) => sum + p.scores[cat], 0) / personas.length),
    ]),
  ) as ValidationScore;

  const totalScore = Math.round(
    personas.reduce((sum, p) => sum + p.total, 0) / personas.length,
  );

  const disagreements = cats
    .map((cat) => {
      const values = personas.map((p) => p.scores[cat]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      return { category: cat, min, max, custDevQuestion: CUSD_DEV_QUESTIONS[cat] };
    })
    .filter((d) => d.max - d.min > 5);

  return { personas, consensus, totalScore, disagreements };
}

// ---------------------------------------------------------------------------
// Exported step
// ---------------------------------------------------------------------------

export async function validationStep(ctx: StepContext): Promise<void> {
  const researchContext = buildResearchContext(ctx);

  // Run all 3 personas in parallel — they share cached research context
  const [skepticResult, advocateResult, analystResult] = await Promise.all([
    scoreIdea(ctx, "skeptic", researchContext),
    scoreIdea(ctx, "advocate", researchContext),
    scoreIdea(ctx, "analyst", researchContext),
  ]);

  ctx.run.validation = synthesise([skepticResult, advocateResult, analystResult]);
}
