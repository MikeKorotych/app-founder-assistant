/**
 * Real, public Google Play listing data via SerpApi's `google_play_product`
 * engine (one product_id per call). Unlike Apple, Google Play PUBLISHES an
 * install bucket ("500M+") on the listing — so this is genuine first-party
 * store data, not a paid third-party estimate. Keyed by `GOOGLE_SEARCH_API_KEY`.
 *
 * Resilient: a failed product is skipped, never throws. Degrades to empty when
 * no key is set (the run still works on the other sources).
 *
 * SerpApi: GET https://serpapi.com/search.json?engine=google_play_product&product_id=&api_key=
 */
const ENDPOINT = "https://serpapi.com/search.json";

export interface GooglePlayDetails {
  /** Bare package id, e.g. "com.duolingo". */
  productId: string;
  /** Parsed lower bound of the official install bucket (500M+ → 500_000_000). */
  installs?: number;
  /** The official install bucket text exactly as Google shows it ("500M+"). */
  installsText?: string;
  rating?: number;
  reviewCount?: number;
  iconUrl?: string;
  /** When the listing was last updated, as Google shows it. */
  updatedOn?: string;
}

/** "500M+" / "500,000,000+" / "1B+" → numeric lower bound. */
function parseInstalls(text?: string): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/[,\s+]/g, "");
  const m = cleaned.match(/^([\d.]+)([KMB]?)$/i);
  if (!m) {
    const n = Number(cleaned.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  const mult: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };
  const num = Number.parseFloat(m[1]);
  if (!Number.isFinite(num)) return undefined;
  return Math.round(num * (mult[m[2].toUpperCase()] ?? 1));
}

interface ProductBody {
  product_info?: {
    rating?: number;
    reviews?: number;
    downloads?: string;
    thumbnail?: string;
  };
  about_this_app?: { downloads?: string };
  updated_on?: string;
  error?: string;
}

async function fetchOne(
  productId: string,
  apiKey: string,
  country: string,
): Promise<GooglePlayDetails | null> {
  const url = `${ENDPOINT}?engine=google_play_product&store=apps&product_id=${encodeURIComponent(
    productId,
  )}&gl=${country}&hl=en&api_key=${apiKey}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const body = (await res.json()) as ProductBody;
  if (body.error || !body.product_info) return null;
  const pi = body.product_info;
  // Prefer the compact bucket ("500M+") for display; parse either form for the number.
  const installsText = pi.downloads ?? body.about_this_app?.downloads;
  return {
    productId,
    installs: parseInstalls(pi.downloads ?? body.about_this_app?.downloads),
    installsText,
    rating: typeof pi.rating === "number" ? pi.rating : undefined,
    reviewCount: typeof pi.reviews === "number" ? pi.reviews : undefined,
    iconUrl: pi.thumbnail,
    updatedOn: body.updated_on,
  };
}

/**
 * Fetch public listing details for the given bare package ids. Accepts ids with
 * or without the scout `play-` prefix; the returned map is keyed by the SAME
 * string that was passed in (so callers can look up by competitor id directly).
 * Bounded by `limit` to respect the Workers per-invocation subrequest budget.
 */
export async function fetchGooglePlayProductDetails(
  ids: string[],
  apiKey: string | undefined,
  opts: { country?: string; limit?: number } = {},
): Promise<Map<string, GooglePlayDetails>> {
  const out = new Map<string, GooglePlayDetails>();
  if (!apiKey) return out;
  const country = opts.country ?? "us";
  const limit = opts.limit ?? 8;
  const unique = [...new Set(ids.filter(Boolean))].slice(0, limit);

  const settled = await Promise.allSettled(
    unique.map(async (raw) => {
      const productId = raw.startsWith("play-") ? raw.slice(5) : raw;
      const details = await fetchOne(productId, apiKey, country);
      return { raw, details };
    }),
  );
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.details) out.set(r.value.raw, r.value.details);
  }
  return out;
}
