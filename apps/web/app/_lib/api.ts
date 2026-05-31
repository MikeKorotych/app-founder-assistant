// The API runs as a SEPARATE Cloudflare Worker on its own domain
// (https://founder-assistant-api.mikekorotych.workers.dev) — its routes live at the ROOT
// (/pipeline, /search-intent, /runs/:id), NOT under an /api prefix and NOT on
// the web domain. Call it directly; the API enables open CORS for browsers.
//
// Override per-env with NEXT_PUBLIC_API_URL (baked at build time, so it must
// carry the NEXT_PUBLIC_ prefix to reach client components).
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://founder-assistant-api.mikekorotych.workers.dev").replace(
  /\/+$/,
  "",
);

/** Build an absolute API URL from a root-relative path, e.g. apiUrl("/pipeline"). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
