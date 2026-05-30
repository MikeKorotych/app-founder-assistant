/**
 * Scout contracts — mobile-app competitor discovery + ranking.
 *
 * Flow: the workflow receives `ScoutParams`, fans out one query per source into
 * `RawCompetitor[]`, merges + dedupes them, then the ranking step scores each
 * against the idea/keywords into a `ScoredCompetitor` (0–100 + rationale).
 */

/** The four sources Scout pulls from. `id`s are prefixed with these. */
export type SourceId = "itunes" | "googleplay" | "producthunt" | "alternativeto";

/**
 * Input payload. `keywords` is required (pre-extracted upstream). `idea` is
 * optional but strongly improves ranking — it's what each candidate's
 * "compatibility" is judged against; without it we fall back to keywords +
 * categories as the idea proxy.
 */
export interface ScoutParams {
  keywords: string[];
  categories?: string[];
  /** Free-text mobile-app idea — the ranking target. Optional. */
  idea?: string;
  /** Store country code (iTunes/Play). Default "us". */
  country?: string;
  /** Max results to request per source per keyword. Default 15. */
  limitPerSource?: number;
}

/** A competitor app before ranking — the unified shape every source maps to. */
export interface RawCompetitor {
  /** Unified key: `${source}-${externalId}` — dedupes across keywords on upsert. */
  id: string;
  name: string;
  source: SourceId;
  description?: string;
  url?: string;
  developer?: string;
  category?: string;
  /** Which platforms this listing covers: "ios" | "android" | "web". */
  platforms: string[];
  /** Human-readable price ("Free", "$4.99"). */
  price?: string;
  rating: number;
  reviewCount: number;
}

/** A competitor after the LLM compatibility-scoring step. */
export interface ScoredCompetitor extends RawCompetitor {
  /** How directly it competes with the idea, 0–100. */
  compatibilityScore: number;
  /** One-line "why it competes" justification. */
  rationale: string;
}

/** What the workflow returns as its instance result. */
export interface ScoutSummary {
  runId: string;
  discovered: number;
  ranked: number;
  topCompetitorId?: string;
}
