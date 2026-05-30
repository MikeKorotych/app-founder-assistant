import express from "express";
import { runAgent } from "./agent.js";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

// Railway healthcheck hits this.
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Entry point for the agentic workflow.
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

app.listen(PORT, () => {
  console.log(`Listening on :${PORT}`);
});
