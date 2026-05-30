import { dedupeById } from "../normalize.js";
import type { RawCompetitor, ScoutParams } from "../types.js";

/**
 * Product Hunt API v2 (GraphQL). Read-only public queries with a developer
 * token (Authorization: Bearer). If no token is set, degrades to empty.
 * Endpoint: https://api.producthunt.com/v2/api/graphql
 *
 * NOTE: PH v2 `posts` has NO free-text search argument. So we pull a batch of
 * the most-upvoted posts and filter client-side by keyword match in the
 * name/tagline/description. Coarse, but honest to what the API exposes.
 */
const ENDPOINT = "https://api.producthunt.com/v2/api/graphql";

const QUERY = `query Popular($first: Int!) {
  posts(order: VOTES, first: $first) {
    edges { node { id name tagline description votesCount url topics(first: 1) { edges { node { name } } } } }
  }
}`;

interface PhNode {
  id?: string;
  name?: string;
  tagline?: string;
  description?: string;
  votesCount?: number;
  url?: string;
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
  };
}

function matchesAnyKeyword(n: PhNode, keywords: string[]): boolean {
  const haystack = `${n.name ?? ""} ${n.tagline ?? ""} ${n.description ?? ""}`.toLowerCase();
  return keywords.some((k) => haystack.includes(k.toLowerCase()));
}

export async function fetchProductHunt(
  params: ScoutParams,
  token: string | undefined,
): Promise<RawCompetitor[]> {
  if (!token) return [];
  // One batch, generous size, then keyword-filter locally.
  const first = Math.min(100, (params.limitPerSource ?? 15) * params.keywords.length + 20);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: QUERY, variables: { first } }),
  });
  if (!res.ok) throw new Error(`Product Hunt ${res.status}`);
  const body = (await res.json()) as { data?: { posts?: { edges?: { node?: PhNode }[] } } };
  const nodes = (body.data?.posts?.edges ?? [])
    .map((e) => e.node)
    .filter((n): n is PhNode => !!n && matchesAnyKeyword(n, params.keywords));
  return dedupeById(nodes.map(toCompetitor).filter((c): c is RawCompetitor => c !== null));
}
