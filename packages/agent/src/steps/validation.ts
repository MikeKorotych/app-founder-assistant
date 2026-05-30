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
  Run,
  ValidationPersona,
  ValidationPersonaResult,
  ValidationResult,
  ValidationScore,
} from "@hahaton/contracts";
import { type LlmProvider, MODELS } from "@hahaton/llm";
import type { StepContext } from "./index";
import { withOutputLanguage } from "../llm-language";

/**
 * Everything the panel scores against. The full pipeline supplies all fields;
 * lighter callers (e.g. the Scout → Validate chain) may supply just `idea` +
 * `competitors`. Personas score sparse categories neutrally and flag the gap,
 * so partial input still yields a usable scorecard.
 */
export interface ValidationInput {
  idea: string;
  brief?: Run["brief"];
  market?: Run["market"];
  competitors?: Run["competitors"];
  canvas?: Run["canvas"];
  gtm?: Run["gtm"];
  assumptions?: Run["assumptions"];
}

// ---------------------------------------------------------------------------
// Context builder — serialises the grounded research into a single block
// that all three personas receive via prompt caching.
// ---------------------------------------------------------------------------

function buildResearchContext(input: ValidationInput): string {
  const lines: string[] = ["=== GROUNDED RESEARCH CONTEXT ===\n"];

  if (input.brief) {
    lines.push(`PROBLEM: ${input.brief.problem}`);
    lines.push(`CUSTOMER: ${input.brief.customer}`);
    lines.push(`VALUE PROP: ${input.brief.valueProp}`);
    lines.push(`GEOGRAPHY: ${input.brief.geography}`);
    if (input.brief.budget) lines.push(`BUDGET: ${input.brief.budget}`);
  }

  if (input.market) {
    lines.push(`\nMARKET SIZING (${input.market.method}):`);
    lines.push(
      `  TAM: ${input.market.tam.value} ${input.market.tam.unit ?? ""} — ${input.market.tam.rationale}`,
    );
    lines.push(
      `  SAM: ${input.market.sam.value} ${input.market.sam.unit ?? ""} — ${input.market.sam.rationale}`,
    );
    lines.push(
      `  SOM: ${input.market.som.value} ${input.market.som.unit ?? ""} — ${input.market.som.rationale}`,
    );
  }

  if (input.competitors?.competitors.length) {
    lines.push(`\nCOMPETITORS (${input.competitors.competitors.length}):`);
    for (const c of input.competitors.competitors.slice(0, 6)) {
      lines.push(
        `  • ${c.name}: ${c.positioning}${c.pricing ? ` | price: ${c.pricing.value}` : ""}`,
      );
    }
  }

  if (input.canvas) {
    lines.push(`\nBUSINESS MODEL CANVAS:`);
    lines.push(`  Revenue streams: ${input.canvas.revenueStreams.join(", ")}`);
    lines.push(`  Customer segments: ${input.canvas.customerSegments.join(", ")}`);
    lines.push(`  Channels: ${input.canvas.channels.join(", ")}`);
  }

  if (input.gtm) {
    lines.push(`\nGTM — FIRST 30 DAYS: ${input.gtm.plan30.join("; ")}`);
    lines.push(`GTM CHANNELS: ${input.gtm.channels.join(", ")}`);
  }

  if (input.assumptions) {
    const a = input.assumptions;
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
If a category has sparse or missing data (e.g. no competitor info, no unit economics yet), score it 10–13 and explicitly note the data gap in rationale — do not penalise the idea for lack of research data.

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
If a category has sparse or missing data, score it 13–16 (slight positive lean) and note what additional evidence would push it higher.

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

Base every score strictly on the research provided. Where data is missing or estimated, flag it in the rationale — score that category 12–14 (neutral) rather than penalising for absent data.
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
  llm: LlmProvider,
  persona: ValidationPersona,
  researchContext: string,
  idea: string,
): Promise<ValidationPersonaResult> {
  const response = await llm.chat({
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
            text: `\nIdea: "${idea}"\n\nScore this idea now.`,
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

  const total =
    scores.problemMarket + scores.solutionDiff + scores.businessModel + scores.gtmTraction;

  return { persona, scores, total, rationale: parsed.rationale };
}

// ---------------------------------------------------------------------------
// Synthesiser — averages + flags disagreements
// ---------------------------------------------------------------------------

const CUSD_DEV_QUESTIONS: Record<keyof ValidationScore, string> = {
  problemMarket:
    "Чи ти поспілкувався з ≥10 потенційними клієнтами? Назви 3, хто сказав, що заплатив би за це вже сьогодні.",
  solutionDiff:
    "Чому клієнт перейде зі свого поточного рішення на твоє? Що робить його у 10× кращим, а не трохи кращим?",
  businessModel:
    "Який реалістичний CAC з твого першого каналу залучення? Чи перевищує LTV ÷ CAC значення 3 протягом 12 місяців?",
  gtmTraction: "Хто твій перший платний клієнт і як ти залучиш його за наступні 30 днів?",
};

function synthesise(personas: ValidationPersonaResult[]): ValidationResult {
  const cats = ["problemMarket", "solutionDiff", "businessModel", "gtmTraction"] as const;

  const consensus = Object.fromEntries(
    cats.map((cat) => [
      cat,
      Math.round(personas.reduce((sum, p) => sum + p.scores[cat], 0) / personas.length),
    ]),
  ) as unknown as ValidationScore;

  const totalScore = Math.round(personas.reduce((sum, p) => sum + p.total, 0) / personas.length);

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
// Reusable entry point — runs the 3-persona panel over any ValidationInput.
// Used by the pipeline step below and by standalone callers (POST /validate,
// the Scout → Validate chain) that have only an idea + discovered competitors.
// ---------------------------------------------------------------------------

export async function validateIdea(
  llm: LlmProvider,
  input: ValidationInput,
): Promise<ValidationResult> {
  const lm = withOutputLanguage(llm);
  const researchContext = buildResearchContext(input);

  // Run all 3 personas in parallel — they share cached research context.
  const [skepticResult, advocateResult, analystResult] = await Promise.all([
    scoreIdea(lm, "skeptic", researchContext, input.idea),
    scoreIdea(lm, "advocate", researchContext, input.idea),
    scoreIdea(lm, "analyst", researchContext, input.idea),
  ]);

  return synthesise([skepticResult, advocateResult, analystResult]);
}

// ---------------------------------------------------------------------------
// Exported step — the pipeline's Step 9, feeding the full grounded run.
// ---------------------------------------------------------------------------

export async function validationStep(ctx: StepContext): Promise<void> {
  ctx.run.validation = await validateIdea(ctx.llm, {
    idea: ctx.run.input.idea,
    brief: ctx.run.brief,
    market: ctx.run.market,
    competitors: ctx.run.competitors,
    canvas: ctx.run.canvas,
    gtm: ctx.run.gtm,
    assumptions: ctx.run.assumptions,
  });
}
