import {
  buildCompetitorProfiles,
  buildOpportunityReport,
  runAgent,
  runPipeline,
  validateIdea,
} from "@hahaton/agent";
import type {
  AgentEvent,
  Assumptions,
  Competitor,
  RunInput,
  SearchExpansion,
} from "@hahaton/contracts";
import { createDb } from "@hahaton/db";
import { createLlmProvider } from "@hahaton/llm";
import {
  classifyReviews,
  collectReviews,
  listCompetitors,
  type RawCompetitor,
  type ScoutParams,
} from "@hahaton/scout";
import { expandSearchIntent } from "@hahaton/search-intent";
import { loadRun, loadSearchExpansion, saveRun, saveSearchExpansion } from "@hahaton/store";
import { computeUnitEconomics } from "@hahaton/unit-economics";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { type BaseEnv, requireLlmEnv } from "./env";

export { CompetitorDiscoveryWorkflow } from "./scout/workflow";

const app = new Hono<BaseEnv>();

app.use("*", cors());

// Liveness probe — no env required.
app.get("/health", (c) => c.json({ status: "ok" }));

// Minimal single-turn agent — the original entry point.
app.post("/agent", async (c) => {
  const { prompt } = await c.req.json().catch(() => ({}));
  if (typeof prompt !== "string" || prompt.length === 0) {
    return c.json({ error: "Body must include a non-empty 'prompt' string." }, 400);
  }
  try {
    requireLlmEnv(c.env);
    const reply = await runAgent(prompt, createLlmProvider(c.env));
    return c.json({ reply });
  } catch (err) {
    console.error("agent error:", err);
    return c.json({ error: "Agent failed." }, 500);
  }
});

// Full Idea → Business Plan pipeline. Runs the orchestrated DAG and persists
// the completed run so it can be replayed via GET /runs/:id.
app.post("/pipeline", async (c) => {
  const { idea, region, budget } = await c.req.json().catch(() => ({}));
  if (typeof idea !== "string" || idea.length === 0) {
    return c.json({ error: "Body must include a non-empty 'idea' string." }, 400);
  }
  const input: RunInput = { idea, region, budget };
  try {
    requireLlmEnv(c.env);
    const run = await runPipeline(input, { llm: createLlmProvider(c.env) });
    await saveRun(createDb(c.env.DB), run);
    return c.json(run);
  } catch (err) {
    console.error("pipeline error:", err);
    return c.json({ error: "Pipeline failed." }, 500);
  }
});

// Streaming variant — emits each AgentEvent over SSE as the pipeline runs, then
// a final `run` event with the persisted result. Consume with EventSource.
app.get("/agent/stream", (c) => {
  const idea = c.req.query("idea") ?? "";
  if (idea.length === 0) {
    return c.json({ error: "Query must include a non-empty 'idea'." }, 400);
  }
  const input: RunInput = {
    idea,
    region: c.req.query("region"),
    budget: c.req.query("budget"),
  };

  return streamSSE(c, async (stream) => {
    try {
      requireLlmEnv(c.env);
    } catch (err) {
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ message: err instanceof Error ? err.message : String(err) }),
      });
      return;
    }

    const queue: AgentEvent[] = [];
    let done = false;
    const pipeline = runPipeline(input, {
      llm: createLlmProvider(c.env),
      onEvent: (e) => queue.push(e),
    }).finally(() => {
      done = true;
    });

    // Drain emitted events to the client as they arrive.
    while (!done || queue.length > 0) {
      const event = queue.shift();
      if (event) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      } else {
        await stream.sleep(50);
      }
    }

    const run = await pipeline;
    await saveRun(createDb(c.env.DB), run);
    await stream.writeSSE({ event: "run", data: JSON.stringify(run) });
  });
});

// Replay a persisted run (the demo safety net).
app.get("/runs/:id", async (c) => {
  const run = await loadRun(createDb(c.env.DB), c.req.param("id"));
  if (!run) return c.json({ error: "Run not found." }, 404);
  return c.json(run);
});

// Scout — spawn the competitor-discovery workflow. Accepts pre-extracted
// keywords/categories (+ an optional idea that sharpens compatibility ranking).
// Returns the instance id immediately; poll GET /scout/:id for status + results.
app.post("/scout", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Partial<ScoutParams>;
  if (!Array.isArray(body.keywords) || body.keywords.length === 0) {
    return c.json({ error: "Body must include a non-empty 'keywords' string array." }, 400);
  }
  const params: ScoutParams = {
    keywords: body.keywords,
    categories: body.categories ?? [],
    idea: body.idea,
    country: body.country,
    limitPerSource: body.limitPerSource,
  };
  const instance = await c.env.DISCOVERY_WORKFLOW.create({ params });
  return c.json({ id: instance.id, status: await instance.status() }, 202);
});

// Scout status + ranked competitors persisted so far.
app.get("/scout/:id", async (c) => {
  const id = c.req.param("id");
  const instance = await c.env.DISCOVERY_WORKFLOW.get(id).catch(() => null);
  if (!instance) return c.json({ error: "Workflow instance not found." }, 404);
  const competitors = await listCompetitors(createDb(c.env.DB), id);
  return c.json({ id, status: await instance.status(), competitors });
});

// Validate — run the Multi-LLM panel (Skeptic / Advocate / Analyst → /100 +
// CustDev gaps) over an idea + already-discovered competitors. This is the
// Scout → Validate chain's final step: stateless, returns a ValidationResult the
// UI renders directly. The full /pipeline runs the same panel as its Step 9.
app.post("/validate", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    idea?: string;
    competitors?: Competitor[];
  };
  if (typeof body.idea !== "string" || body.idea.length === 0) {
    return c.json({ error: "Body must include a non-empty 'idea' string." }, 400);
  }
  try {
    requireLlmEnv(c.env);
    const competitors =
      Array.isArray(body.competitors) && body.competitors.length > 0
        ? { competitors: body.competitors }
        : undefined;
    const validation = await validateIdea(createLlmProvider(c.env), {
      idea: body.idea,
      competitors,
    });
    return c.json(validation);
  } catch (err) {
    console.error("validate error:", err);
    return c.json({ error: "Validation failed." }, 500);
  }
});

// Opportunity analysis — mine the discovered competitors' reviews, classify
// them into signals, then synthesize the Opportunity Radar (decision map) +
// per-competitor Competitive Landscape. Stateless; returns { report, profiles }
// the UI renders directly. Reviews fetched live (iTunes RSS + SerpApi); no paid
// market-intel keys → install figures are estimated client-side.
app.post("/opportunity", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { idea?: string; scoutId?: string };
  if (typeof body.idea !== "string" || body.idea.length === 0) {
    return c.json({ error: "Body must include a non-empty 'idea' string." }, 400);
  }
  if (typeof body.scoutId !== "string" || body.scoutId.length === 0) {
    return c.json({ error: "Body must include a 'scoutId'." }, 400);
  }
  try {
    requireLlmEnv(c.env);
    const rows = await listCompetitors(createDb(c.env.DB), body.scoutId);
    const competitors = rows.map((r) => ({
      id: r.id,
      name: r.name,
      source: r.source,
      url: r.url ?? undefined,
      positioning: r.rationale ?? r.description ?? undefined,
      platforms: [] as string[],
      reviewCount: r.reviewCount ?? 0,
      rating: r.rating ?? undefined,
      launchedAt: r.launchedAt ?? undefined,
    }));

    const reviews = await collectReviews(competitors as unknown as RawCompetitor[], {
      searchApiKey: c.env.GOOGLE_SEARCH_API_KEY,
    });
    const llm = createLlmProvider(c.env);
    const signals = await classifyReviews(llm, reviews);

    const sourceCounts = new Map<string, number>();
    for (const r of reviews) sourceCounts.set(r.source, (sourceCounts.get(r.source) ?? 0) + 1);
    const sources = [...sourceCounts.entries()].map(([source, reviewsCount]) => ({
      source,
      reviews: reviewsCount,
    }));

    const [report, profiles] = await Promise.all([
      buildOpportunityReport(llm, {
        idea: body.idea,
        signals,
        reviewsAnalyzed: reviews.length,
        sources,
        competitorNames: competitors.slice(0, 8).map((x) => x.name),
      }),
      buildCompetitorProfiles(llm, { idea: body.idea, competitors, signals }),
    ]);

    return c.json({ report, profiles });
  } catch (err) {
    console.error("opportunity error:", err);
    return c.json({ error: "Opportunity analysis failed." }, 500);
  }
});

// Expand a raw UI search query into comprehensive, noise-free keywords +
// categories, persist it, and return the saved record (with id) so the UI can
// show what was queried and downstream services (scout) can fan out from it.
app.post("/search-intent", async (c) => {
  const { query, locale } = await c.req.json().catch(() => ({}));
  if (typeof query !== "string" || query.length === 0) {
    return c.json({ error: "Body must include a non-empty 'query' string." }, 400);
  }
  try {
    requireLlmEnv(c.env);
    const intent = await expandSearchIntent(
      { query, locale: typeof locale === "string" ? locale : undefined },
      createLlmProvider(c.env),
    );
    const expansion: SearchExpansion = {
      id: crypto.randomUUID(),
      query,
      locale: typeof locale === "string" ? locale : undefined,
      keywords: intent.keywords,
      categories: intent.categories,
      createdAt: new Date().toISOString(),
    };
    await saveSearchExpansion(createDb(c.env.DB), expansion);
    return c.json(expansion);
  } catch (err) {
    console.error("search-intent error:", err);
    return c.json({ error: "Search intent expansion failed." }, 500);
  }
});

// Replay a persisted search expansion by id (consumed by the UI and scout).
app.get("/search-intent/:id", async (c) => {
  const expansion = await loadSearchExpansion(createDb(c.env.DB), c.req.param("id"));
  if (!expansion) return c.json({ error: "Search expansion not found." }, 404);
  return c.json(expansion);
});

// Recompute unit economics from assumptions — pure, no LLM round-trip.
app.post("/unit-economics", async (c) => {
  const assumptions = (await c.req.json().catch(() => null)) as Assumptions | null;
  if (!assumptions?.arpu) {
    return c.json({ error: "Body must be a full Assumptions object." }, 400);
  }
  return c.json(computeUnitEconomics(assumptions));
});

export default app;
