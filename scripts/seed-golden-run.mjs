/**
 * Seeds a fully-populated "golden" Run into local D1 — the demo replay safety net
 * and a fixture for building/polishing the report UI without the LLM gateway.
 *
 * Usage:
 *   node scripts/seed-golden-run.mjs                 # writes scripts/.golden.sql
 *   pnpm --filter @hahaton/api exec wrangler d1 execute hahaton --local --file=../../scripts/.golden.sql
 *
 * Then open /runs/golden-dogfood. The Run conforms to @hahaton/contracts (Run).
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const at = "2026-05-30T12:00:00.000Z";
const cite = (id, url, title, snippet) => ({ id, url, title, snippet, accessedAt: at });
const f = (value, unit, rationale, citationId, estimated) => {
  const o = { value, unit, rationale };
  if (citationId) o.citationId = citationId;
  if (estimated) o.estimated = true;
  return o;
};

const citations = [
  cite("c1", "https://www.grandviewresearch.com/industry-analysis/pet-food-market", "Europe Pet Food Market Size Report", "Europe pet food market ~USD 38.4B in 2024, ~5% CAGR; fresh/premium fastest-growing."),
  cite("c2", "https://www.crunchbase.com/organization/butternut-box", "Butternut Box — Crunchbase", "UK fresh dog food subscription; raised USD 350M+ Series E (2023)."),
  cite("c3", "https://www.lilyskitchen.co.uk/", "Lily's Kitchen", "Premium natural pet food, acquired by Nestlé Purina (2020)."),
  cite("c4", "https://www.statista.com/statistics/poland-pet-ownership", "Poland Pet Ownership — Statista", "~8.3M dogs in Polish households; premium pet spend rising double digits."),
  cite("c5", "https://www.bluepearlvet.com/fresh-pet-food-trends", "Fresh Pet Food Trends 2025", "Fresh/refrigerated dog food is the fastest-growing EU pet-food format."),
];

const run = {
  id: "golden-dogfood",
  input: { idea: "A subscription that delivers vet-formulated fresh dog food to pet owners in Poland.", region: "PL" },
  createdAt: at,
  status: "completed",
  brief: {
    problem: "Polish dog owners increasingly distrust mass-market kibble but lack convenient access to vet-formulated fresh food tailored to their dog.",
    customer: "Urban, higher-income dog owners (25–45) in Warsaw, Kraków, Wrocław who treat pets as family.",
    valueProp: "Vet-formulated, portioned fresh meals delivered on a subscription — healthier than kibble, more convenient than cooking.",
    geography: "Poland (urban-first)",
    researchQuestions: [
      "How large is the premium/fresh dog-food segment in Poland?",
      "Who are the incumbent fresh-food subscriptions and are they in Poland yet?",
      "What CAC and churn are realistic for a DTC food subscription in CEE?",
    ],
  },
  market: {
    method: "top-down",
    tam: f(38400000000, "USD", "EU pet food market 2024 (Grand View Research).", "c1"),
    sam: f(900000000, "USD", "Poland premium/fresh dog-food share, derived from EU figures + Poland pet spend.", "c4"),
    som: f(18000000, "USD", "~2% of Polish SAM reachable in 3 years via urban DTC.", undefined, true),
    notes: "Fresh/refrigerated is the fastest-growing format; premium spend in Poland rising double digits.",
  },
  competitors: {
    competitors: [
      { name: "Butternut Box", positioning: "UK leader, fresh DTC subscription; expanding across EU", pricing: f("€2–5 / day", undefined, "Public pricing page; varies by dog weight.", "c2"), funding: f("$350M+ Series E", undefined, "Crunchbase.", "c2"), url: "https://butternutbox.com", citationId: "c2" },
      { name: "Lily's Kitchen", positioning: "Premium natural, retail + online (Nestlé-owned)", pricing: f("€3–4 / day", undefined, "Retail premium tier.", "c3"), url: "https://lilyskitchen.co.uk", citationId: "c3" },
      { name: "Pupil Foods (PL)", positioning: "Local Polish premium dog food, limited fresh range", url: "https://pupil.com.pl", citationId: "c4" },
      { name: "Local kibble brands", positioning: "Mass-market incumbents; price-led, not fresh", estimated: true },
    ],
  },
  canvas: {
    customerSegments: ["Urban dog owners 25–45", "Premium pet-spend households", "Dogs with dietary needs"],
    valuePropositions: ["Vet-formulated fresh meals", "Portioned & delivered", "Healthier than kibble", "Convenient subscription"],
    channels: ["Paid social (Meta/TikTok)", "Vet-clinic partnerships", "Referral program", "Influencer/UGC"],
    customerRelationships: ["Subscription", "Personalized feeding plan", "Vet support chat"],
    revenueStreams: ["Monthly subscription", "Add-on treats/supplements"],
    keyResources: ["Cold-chain logistics", "Vet nutrition team", "Brand"],
    keyActivities: ["Meal production", "Cold delivery", "Retention/CRM"],
    keyPartnerships: ["Local kitchens/producers", "Cold-chain couriers", "Veterinary clinics"],
    costStructure: ["COGS (ingredients)", "Cold logistics", "CAC/marketing", "Fixed overhead"],
  },
  gtm: {
    channels: ["Meta/TikTok paid", "Vet-clinic referrals", "Influencer seeding (PL dog community)"],
    plan30: ["Landing + waitlist", "10 vet-clinic LOIs", "Creative testing on Meta"],
    plan60: ["Pilot in Warsaw", "First 100 subscribers", "Tune feeding-plan quiz"],
    plan90: ["Expand Kraków/Wrocław", "Referral loop live", "Hit 500 active subs"],
    hypotheses: ["Vet referrals beat paid on CAC", "Quiz lifts conversion >2.5%", "Churn <6% with feeding plan"],
  },
  assumptions: {
    arpu: f(45, "EUR/mo", "Avg subscription for a medium dog, benchmarked to Butternut.", "c2"),
    grossMarginPct: f(35, "%", "Fresh food COGS + cold logistics are heavy; 35% is realistic early.", undefined, true),
    cac: f(55, "EUR", "Blended paid + referral CAC for DTC food in CEE.", undefined, true),
    monthlyChurnPct: f(6, "%", "Food subscriptions churn 5–8%/mo early.", undefined, true),
    conversionPct: f(2.5, "%", "Landing→paid conversion with a feeding-plan quiz.", undefined, true),
    fixedMonthlyCost: f(18000, "EUR", "Kitchen, vet team, ops overhead.", undefined, true),
    funnelVolume: f(12000, "users", "Monthly top-of-funnel from paid + organic at pilot scale.", undefined, true),
  },
  risks: {
    risks: [
      { title: "Cold-chain logistics cost", likelihood: "high", impact: "high", mitigation: "Start hyper-local (Warsaw) to keep delivery dense and cheap." },
      { title: "Low gross margin", likelihood: "medium", impact: "high", mitigation: "Optimize recipes/portioning; add high-margin treats." },
      { title: "Incumbent EU expansion (Butternut)", likelihood: "medium", impact: "medium", mitigation: "Win on local taste, vet partnerships, faster delivery." },
      { title: "CAC creep", likelihood: "medium", impact: "high", mitigation: "Lean on vet referrals + referral loop over paid." },
    ],
  },
  synthesis: {
    executiveSummary: "Fresh, vet-formulated dog food on subscription for Poland's fast-growing premium pet segment — convenience of DTC with a health story incumbents can't match locally.",
    narrative: "Poland's premium pet spend is rising double-digits and fresh is the fastest-growing format, yet the EU leader (Butternut) hasn't localized. A Warsaw-first, vet-referral-led launch can win on taste, trust and delivery speed before incumbents arrive. The model hinges on disciplined CAC (vet referrals) and improving the thin fresh-food margin via treats and portioning.",
    deckOutline: [
      { slide: "Problem", bullets: ["Owners distrust kibble", "No convenient local fresh option"] },
      { slide: "Market", bullets: ["EU pet food $38.4B", "PL premium rising double digits", "Fresh = fastest format"] },
      { slide: "Solution", bullets: ["Vet-formulated fresh meals", "Portioned & delivered", "Feeding-plan quiz"] },
      { slide: "Competition", bullets: ["Butternut not localized", "Lily's retail-only", "Local brands not fresh"] },
      { slide: "Business model", bullets: ["€45/mo ARPU", "Subscription + treats"] },
      { slide: "GTM", bullets: ["Vet referrals", "Warsaw pilot → 500 subs"] },
      { slide: "Ask", bullets: ["Seed round for pilot + cold-chain"] },
    ],
  },
  validation: {
    personas: [
      { persona: "skeptic", scores: { problemMarket: 17, solutionDiff: 12, businessModel: 11, gtmTraction: 13 }, total: 53, rationale: { problemMarket: "Real but niche; price-sensitive market.", solutionDiff: "Fresh food is copyable; Butternut could localize fast.", businessModel: "35% margin + cold chain is brutal.", gtmTraction: "Vet referrals unproven at scale." } },
      { persona: "advocate", scores: { problemMarket: 23, solutionDiff: 20, businessModel: 18, gtmTraction: 21 }, total: 82, rationale: { problemMarket: "Premium pet spend booming, owners want fresh.", solutionDiff: "Local-first + vet trust is a real moat in PL.", businessModel: "Treats/add-ons lift margin; LTV strong.", gtmTraction: "Vet referrals = low-CAC channel incumbents lack." } },
      { persona: "analyst", scores: { problemMarket: 20, solutionDiff: 16, businessModel: 14, gtmTraction: 17 }, total: 67, rationale: { problemMarket: "Solid demand, sizeable urban segment.", solutionDiff: "Differentiation defensible only if local execution is fast.", businessModel: "Margin is the crux — needs proof.", gtmTraction: "Channel plausible; needs pilot data." } },
    ],
    consensus: { problemMarket: 20, solutionDiff: 16, businessModel: 14, gtmTraction: 17 },
    totalScore: 67,
    disagreements: [
      { category: "solutionDiff", min: 12, max: 20, custDevQuestion: "If Butternut localized to Poland in 6 months, why would customers still choose us?" },
      { category: "businessModel", min: 11, max: 18, custDevQuestion: "What gross margin can we actually hit at 500 subs, including cold-chain?" },
      { category: "gtmTraction", min: 13, max: 21, custDevQuestion: "Will vet clinics actually refer, and at what conversion + cost?" },
    ],
  },
  citations,
  events: [
    { type: "run_started", runId: "golden-dogfood", input: { idea: "fresh dog food subscription, Poland" }, at },
    { type: "step_started", step: "brief", label: "Structuring the idea", at }, { type: "step_completed", step: "brief", at },
    { type: "step_started", step: "market", label: "Sizing the market", at },
    { type: "tool_call", step: "market", tool: "web_search", query: "Europe pet food market size 2024", at },
    { type: "source_found", step: "market", citation: citations[0], at },
    { type: "source_found", step: "market", citation: citations[3], at },
    { type: "step_completed", step: "market", at },
    { type: "step_started", step: "competitors", label: "Scanning competitors", at },
    { type: "tool_call", step: "competitors", tool: "web_search", query: "fresh dog food subscription competitors EU", at },
    { type: "source_found", step: "competitors", citation: citations[1], at },
    { type: "step_completed", step: "competitors", at },
    { type: "step_started", step: "canvas", label: "Building the business model", at }, { type: "step_completed", step: "canvas", at },
    { type: "step_started", step: "gtm", label: "Planning go-to-market", at }, { type: "step_completed", step: "gtm", at },
    { type: "step_started", step: "unitEconomics", label: "Modeling unit economics", at }, { type: "step_completed", step: "unitEconomics", at },
    { type: "step_started", step: "risks", label: "Assessing risks", at }, { type: "step_completed", step: "risks", at },
    { type: "step_started", step: "synthesis", label: "Assembling the pitch", at }, { type: "step_completed", step: "synthesis", at },
    { type: "step_started", step: "validation", label: "Validating with Multi-LLM panel", at }, { type: "step_completed", step: "validation", at },
    { type: "run_completed", runId: "golden-dogfood", at },
  ],
};

const esc = JSON.stringify(run).replace(/'/g, "''");
const out = join(dirname(fileURLToPath(import.meta.url)), ".golden.sql");
writeFileSync(out, `DELETE FROM runs WHERE id='golden-dogfood';\nINSERT INTO runs (id, status, data) VALUES ('golden-dogfood', 'completed', '${esc}');\n`);
console.log("wrote", out, "(run id: golden-dogfood,", JSON.stringify(run).length, "bytes)");
