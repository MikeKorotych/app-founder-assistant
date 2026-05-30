import type { Assumptions, UnitEconomics } from "@hahaton/contracts";

/**
 * Deterministic unit-economics engine. This is the single source of truth for
 * every number shown on screen — the LLM only supplies `Assumptions`, never math.
 *
 * Pure & side-effect free: the UI calls this locally on every slider change to
 * recompute instantly (no LLM round-trip). Keep it that way.
 *
 * Formulas (standard SaaS-style):
 *   contributionPerCustomer = arpu * grossMargin            (monthly gross profit/customer)
 *   ltv                      = contributionPerCustomer / churn
 *   ltvCacRatio              = ltv / cac
 *   paybackMonths            = cac / contributionPerCustomer
 *   breakEvenCustomers       = fixedMonthlyCost / contributionPerCustomer
 *   monthlyBurn              = fixedMonthlyCost + newCustomers * cac   (steady acquisition)
 */
export function computeUnitEconomics(a: Assumptions): UnitEconomics {
  const arpu = a.arpu.value;
  const margin = a.grossMarginPct.value / 100;
  const cac = a.cac.value;
  const churn = a.monthlyChurnPct.value / 100;
  const conversion = a.conversionPct.value / 100;
  const fixed = a.fixedMonthlyCost.value;
  const funnel = a.funnelVolume.value;

  const warnings: string[] = [];

  const contributionPerCustomer = arpu * margin;

  const ltv = churn > 0 ? contributionPerCustomer / churn : Infinity;
  const ltvCacRatio = cac > 0 ? ltv / cac : Infinity;
  const paybackMonths = contributionPerCustomer > 0 ? cac / contributionPerCustomer : Infinity;
  const breakEvenCustomers = contributionPerCustomer > 0 ? fixed / contributionPerCustomer : Infinity;

  const newCustomers = funnel * conversion;
  const monthlyBurn = fixed + newCustomers * cac;

  // Sanity flags — these surface in the UI as "the agent self-checks" signals.
  if (churn <= 0) warnings.push("Churn is 0% — LTV is unbounded; set a realistic churn.");
  if (contributionPerCustomer <= 0) warnings.push("Contribution per customer ≤ 0 — revenue does not cover variable cost.");
  if (Number.isFinite(ltvCacRatio) && ltvCacRatio < 3) {
    warnings.push(`LTV:CAC is ${ltvCacRatio.toFixed(1)} — below the 3.0 viability benchmark.`);
  }
  if (Number.isFinite(paybackMonths) && paybackMonths > 12) {
    warnings.push(`CAC payback is ${paybackMonths.toFixed(0)} months — long; >12 strains cash.`);
  }

  return {
    ltv,
    ltvCacRatio,
    paybackMonths,
    contributionPerCustomer,
    breakEvenCustomers,
    monthlyBurn,
    warnings,
  };
}
