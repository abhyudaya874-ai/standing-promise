---
description: Astropods: host the Promise concierge agent (AI Gateway model, read-only tools into our app). Verified against RFC-1, Deploy and AI Gateway docs
---

# Astropods: the Promise concierge

**What changed from v2.0 of this pack:** v2.0 had the app call an Astropods-hosted "observer" over HTTP. The docs do not support that:
a deployed agent is a human-facing web/Slack agent behind sign-in, and `frontend` agents must serve on **port 80**.
So the direction is now **agent → our app**: the concierge calls our read-only `/api/verdict/replay` and `/api/studio/query`,
and its model comes from the Astropods **AI Gateway** (OpenAI-compatible chat completions, no provider key).
Nothing in the money path calls Astropods; the app only shows a link (`ASTROPODS_AGENT_URL`).

In the pack: `reference/astropods/` (`astropods.yml`, `Dockerfile`, `agent.mjs`, `server.mjs`, `agent.test.mjs`, `AGENT.md`).

1. Prove the agent logic first, no account needed: `node --test astropods/agent.test.mjs` (4 tests: tool loop, bad-id rejection, tool clamp, step limit).
2. Sign up, install the CLI per https://docs.astropods.com, `ast login`.
3. `cd astropods && ast spec validate`. RFC-1 (https://docs.astropods.com/astropods-package-spec) is the source of truth; fix what it reports.
4. Deploy the app to Render first (`/wire-render`) so `PROMISE_API_URL` is a public URL the agent can reach.
5. `ast blueprint push promise-concierge`, then `ast blueprint deploy promise-concierge` and supply the input `PROMISE_API_URL=https://<app>.onrender.com`.
6. `ast agent list` until it is running; open the launch URL (sign-in is on by default; that is fine for a judge demo).
7. Ask it: "what happened to the last three promises?" then "why was <id> released?". It should call `list_recent_verdicts` / `replay_verdict` and quote a reason code.
8. Set `ASTROPODS_AGENT_URL=<launch url>` and `CAP_ASTROPODS=1`: the home page links to it.
9. Screenshot the Astropods dashboard (usage, latency, tool calls) for the "observability" claim.

Still unverified (needs an account): tool calling through the gateway ("OpenAI-compatible" per the docs; if no tool calls appear, read
https://docs.astropods.com/ai-gateway/chat), and the Agent Card frontmatter in `AGENT.md` (https://docs.astropods.com/agent-card-spec).
Degraded: with the flag off there is simply no link. The demo never depends on it.
