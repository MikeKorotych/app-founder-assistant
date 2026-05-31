import { dedupeById } from "../normalize.js";
import type { RawCompetitor, ScoutParams } from "../types.js";

/**
 * Product Hunt API v2 (GraphQL). Read-only public queries with a developer
 * token (Authorization: Bearer). If no token is set, degrades to empty.
 * Endpoint: https://api.producthunt.com/v2/api/graphql
 *
 * PH v2 `posts` has NO free-text search argument, but it DOES accept a `topic`
 * slug. So instead of pulling a global most-upvoted batch (which never matches
 * a niche keyword), we map each requested category to a PH topic slug and pull
 * that topic's most-upvoted posts. Relevance comes from the topic itself; the
 * final compatibility call is left to the downstream LLM ranking step.
 *
 * With no categories we fall back to slugified keywords as candidate topics —
 * most won't be real PH topics (those queries simply return empty), but it lets
 * a keyword that *is* a topic (e.g. "productivity") still surface results.
 */
const ENDPOINT = "https://api.producthunt.com/v2/api/graphql";

const QUERY = `query Topic($slug: String!, $first: Int!) {
  posts(topic: $slug, order: VOTES, first: $first) {
    edges { node { id name tagline description votesCount url featuredAt createdAt topics(first: 1) { edges { node { name } } } } }
  }
}`;

/** Cap on distinct topic slugs queried per run (one PH request each). Kept low
 * so the four scout sources together stay under the free-plan subrequest cap. */
const MAX_TOPICS = 4;

interface PhNode {
  id?: string;
  name?: string;
  tagline?: string;
  description?: string;
  votesCount?: number;
  url?: string;
  /** When the post hit the PH homepage — PH's "Launched" date. ISO 8601. */
  featuredAt?: string;
  /** When the post was created — fallback for posts never featured. ISO 8601. */
  createdAt?: string;
  topics?: { edges?: { node?: { name?: string } }[] };
}

function toCompetitor(n: PhNode): RawCompetitor | null {
  if (!n.id || !n.name) return null;
  return {
    id: `ph-${n.id}`,
    name: n.name,
    source: "producthunt",
    description: n.description ?? n.tagline,
    url: n.url,
    category: n.topics?.edges?.[0]?.node?.name,
    platforms: ["web"],
    rating: 0,
    // PH has no star rating; upvotes are the popularity proxy.
    reviewCount: n.votesCount ?? 0,
    // "Launched" on PH = the featured date; fall back to creation date.
    launchedAt: n.featuredAt ?? n.createdAt,
  };
}

/**
 * PH topic slugs are lowercase-hyphenated. Slugify a free-text category and
 * apply a few aliases for the common name↔slug mismatches.
 */
const TOPIC_ALIASES: Record<string, string> = {
  "health-fitness": "health-and-fitness",
  health: "health-and-fitness",
  fitness: "health-and-fitness",
  finance: "fintech",
  "dev-tools": "developer-tools",
  dev: "developer-tools",
  "artificial-intelligence": "artificial-intelligence",
  ai: "artificial-intelligence",
};

function toTopicSlug(category: string): string {
  const base = category
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return TOPIC_ALIASES[base] ?? base;
}

/**
 * Pull one topic's most-upvoted posts. HTTP-level failures throw so the
 * workflow step retries; an unknown topic comes back as a 200 with a GraphQL
 * error and null `posts`, which we treat as simply "no results" and skip.
 */
async function fetchTopic(slug: string, first: number, token: string): Promise<RawCompetitor[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: QUERY, variables: { slug, first } }),
  });
  if (!res.ok) throw new Error(`Product Hunt ${res.status}`);
  const body = (await res.json()) as {
    data?: { posts?: { edges?: { node?: PhNode }[] } };
  };
  const nodes = (body.data?.posts?.edges ?? []).map((e) => e.node).filter((n): n is PhNode => !!n);
  return nodes.map(toCompetitor).filter((c): c is RawCompetitor => c !== null);
}

export async function fetchProductHunt(
  params: ScoutParams,
  token: string | undefined,
): Promise<RawCompetitor[]> {
  if (!token) return [];
  const source = params.categories?.length ? params.categories : params.keywords;
  const slugs = Array.from(new Set(source.map(toTopicSlug).filter(Boolean))).slice(0, MAX_TOPICS);
  if (slugs.length === 0) return [];

  const first = Math.min(50, params.limitPerSource ?? 15);
  const perTopic = await Promise.all(slugs.map((slug) => fetchTopic(slug, first, token)));
  return dedupeById(perTopic.flat());
}
