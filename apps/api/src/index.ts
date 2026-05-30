import express from "express";
import { runAgent, runPipeline } from "@hahaton/agent";
import { loadRun, saveRun } from "@hahaton/store";
import { computeUnitEconomics } from "@hahaton/unit-economics";
import type { Assumptions, RunInput } from "@hahaton/contracts";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

// Platform healthcheck hits this.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Minimal single-turn agent — the original entry point.
app.post("/agent", async (req, res) => {
  const { prompt } = req.body ?? {};
  if (typeof prompt !== "string" || prompt.length === 0) {
    return res.status(400).json({ error: "Body must include a non-empty 'prompt' string." });
  }

  try {
    const reply = await runAgent(prompt);
    res.json({ reply });
  } catch (err) {
    console.error("agent error:", err);
    res.status(500).json({ error: "Agent failed." });
  }
});

// Full Idea → Business Plan pipeline. Runs the orchestrated DAG and persists
// the completed run so it can be replayed via GET /runs/:id.
app.post("/pipeline", async (req, res) => {
  const { idea, region, budget } = req.body ?? {};
  if (typeof idea !== "string" || idea.length === 0) {
    return res.status(400).json({ error: "Body must include a non-empty 'idea' string." });
  }

  const input: RunInput = { idea, region, budget };
  try {
    const run = await runPipeline(input);
    await saveRun(run);
    res.json(run);
  } catch (err) {
    console.error("pipeline error:", err);
    res.status(500).json({ error: "Pipeline failed." });
  }
});

// Replay a persisted run (the demo safety net).
app.get("/runs/:id", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found." });
  res.json(run);
});

// Recompute unit economics from assumptions — pure, no LLM round-trip.
app.post("/unit-economics", (req, res) => {
  const assumptions = req.body as Assumptions | undefined;
  if (!assumptions?.arpu) {
    return res.status(400).json({ error: "Body must be a full Assumptions object." });
  }
  res.json(computeUnitEconomics(assumptions));
});

app.listen(PORT, () => {
  console.log(`Listening on :${PORT}`);
});
