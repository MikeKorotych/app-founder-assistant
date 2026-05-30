# hahaton-2026

Basic agentic workflow service (Node + TypeScript), deployable to Railway.

## Stack
- Node 20, TypeScript (ESM)
- Express HTTP server
- `@anthropic-ai/sdk` for the agent

## Local development
```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm run dev            # hot-reload on http://localhost:3000
```

Test it:
```bash
curl -X POST http://localhost:3000/agent \
  -H "content-type: application/json" \
  -d '{"prompt":"hello"}'
```

## Endpoints
- `GET /health` — healthcheck (used by Railway)
- `POST /agent` — `{ "prompt": "..." }` → `{ "reply": "..." }`

## Deploy to Railway
1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**, pick this repo.
3. Add the `ANTHROPIC_API_KEY` variable under the service's **Variables** tab.
4. Railway auto-builds via Nixpacks (`railway.json` pins build/start/healthcheck).
   `PORT` is injected by Railway automatically.

## Where to build next
- `src/agent.ts` — add tool definitions and a tool-use loop for real agentic behavior.
- `src/index.ts` — add webhook routes (Telegram/Slack/Discord) if this is a bot.
