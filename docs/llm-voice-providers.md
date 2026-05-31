# LLM & Voice providers — comparison (May 2026)

Context: route multi-model **text** pipelines (this tool + future products), and
add **voice** (interview-simulator: STT+TTS; LangFlip: cloud TTS + Wispr-Flow-style
realtime STT). Key point up front: **OpenRouter and Ollama are TEXT/LLM platforms —
neither does production voice.** Voice needs dedicated STT/TTS providers.

## Text LLM: OpenRouter vs Ollama Cloud

| | OpenRouter | Ollama Cloud (Turbo) |
|---|---|---|
| Model range | **300+**, incl. frontier (Claude, GPT, Gemini) + open | **Open models only** (gpt-oss, deepseek-v4, qwen, llama) — no Claude/GPT/Gemini |
| API | OpenAI-compatible (drop-in) | Ollama API (same as local → local↔cloud parity) |
| Pricing | Pay-per-token passthrough ($0–$75 / M tokens); **free `:free` models** | Flat: Free $0 / **Pro $20/mo** / Max $100/mo (GPU-time based) |
| Free tier | 50 req/day (`:free`), 1000/day after $10 credits; 20 rpm | Session (5h reset) + weekly limits; 1 concurrent model |
| Best for | **Routing across many models incl. frontier**, pay-as-you-go | **Heavy use of open models at flat cost** + local-dev parity |

**Verdict for your case:**
- **This tool / Strategy-&-Growth work** → reasoning quality matters (sizing,
  synthesis, validation) → you want frontier models → **OpenRouter** (one key,
  Claude + GPT + open, env-only swap). Recommended now.
- **Ollama Cloud Pro ($20/mo)** makes sense later if you run **open models at
  volume** and like the flat cost + identical local/cloud API. It can't give you
  Claude/GPT, so it's a complement, not a replacement, for frontier pipelines.
- Practical: start OpenRouter; add Ollama Cloud if/when open-model volume grows.

Sources: [Ollama pricing](https://ollama.com/pricing) ·
[Ollama Cloud Free vs Pro 2026](https://devtoolhub.com/ollama-cloud-free-vs-pro-limits-pricing-2026/) ·
[OpenRouter pricing](https://openrouter.ai/pricing) ·
[OpenRouter free tier limits](https://costbench.com/software/llm-api-providers/openrouter/free-plan/)

## Voice — neither OpenRouter nor Ollama; use dedicated providers

### Speech-to-text (Wispr-Flow-style realtime, LangFlip on-the-fly insert)
| Provider | Latency | Price | Note |
|---|---|---|---|
| **Deepgram** (Flux/Nova-3) | sub-300ms streaming (WebSocket) | ~$0.26/hr | Best for realtime voice agents + on-the-fly insert |
| **Groq Whisper** | near-realtime | **~$0.02/hr (cheapest)** | Whisper accuracy, LPU-fast, generous free tier |
| ElevenLabs Scribe v2 RT | ~150ms, 90+ langs | mid | Strong multilingual realtime |
| AssemblyAI Universal-Streaming | sub-400ms | ~$0.45/hr | + transcript intelligence (sentiment, PII) |

→ **Wispr-Flow analog in LangFlip**: Deepgram streaming (WebSocket, partials inserted
as you speak) is the grade you want; Groq Whisper if near-realtime + low cost is enough.

### Text-to-speech (LangFlip cloud TTS replacing slow local)
| Provider | Latency | Price | Note |
|---|---|---|---|
| **Cartesia Sonic 4** | **~40ms (fastest)** | $38 / M chars | Best raw latency/cost |
| Deepgram Aura-2 | sub-200ms | $30 / M chars | All voices included, enterprise/on-prem |
| ElevenLabs Flash v2.5 / v3 | ~75ms | credits ($22/mo ≈ 100k chars) | Most expressive, 70+ langs, 5000+ voices |
| OpenAI gpt-4o-mini-tts | — | ~$0.015/min | Simplest if you live in OpenAI |

→ **LangFlip cloud TTS**: Cartesia (fast + cheap) or Deepgram Aura-2 to kill the
slow-local-model problem; ElevenLabs if expressiveness/voice variety matters more.

### Interview simulator (conversational voice)
Two paths:
- **Pipeline** (most control/cost): Deepgram STT → OpenRouter LLM → Cartesia/ElevenLabs TTS.
- **All-in-one**: OpenAI Realtime API (gpt-realtime) — simplest, but locks you into OpenAI.

Sources: [STT comparison 2026](https://deepgram.com/learn/best-speech-to-text-apis-2026) ·
[Realtime STT models](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription) ·
[TTS comparison 2026](https://futureagi.com/blog/best-text-to-speech-providers-2026/) ·
[AI voice cost calculator](https://softcery.com/ai-voice-agents-calculator)

## Bottom line
- **This project's pipeline**: OpenRouter now (frontier breadth, env-only). Revisit
  Ollama Cloud Pro when open-model volume justifies the flat $20.
- **Voice projects**: don't expect it from OpenRouter/Ollama. STT → Deepgram (or Groq
  Whisper for cost); TTS → Cartesia (or ElevenLabs for expressiveness); interview sim →
  STT→LLM→TTS pipeline or OpenAI Realtime.
