import type { SearchIntent } from "@hahaton/contracts";

/**
 * Extracts the outermost JSON object from a model response. Tolerates markdown
 * code fences and any stray prose around the object. Returns null if none found.
 */
export function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return body.slice(start, end + 1);
}

/** Coerces an unknown value into a clean, deduplicated string array. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Parses + normalizes a model response into a {@link SearchIntent}. Defensive:
 * recovers from fences/prose and missing fields. Throws only when there is no
 * parseable JSON object at all.
 */
export function parseSearchIntent(content: string): SearchIntent {
  const json = extractJsonObject(content);
  if (json === null) {
    throw new Error("search-intent: model response contained no JSON object");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("search-intent: model response was not valid JSON");
  }
  const obj = (parsed ?? {}) as Record<string, unknown>;
  return {
    keywords: toStringArray(obj.keywords),
    categories: toStringArray(obj.categories),
  };
}
