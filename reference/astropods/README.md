# Astropods: Promise concierge

Verified against RFC-1 (Astropods Spec v1.9), the Deploy page and the AI Gateway page.
What Astropods does and does NOT do, so nobody builds the wrong thing:

- A deployed agent is a **human-facing** agent: web chat behind sign-in, a Slack bot, or (as here) its own `frontend` UI on port 80.
  It is not documented as a backend our app can call. So the direction is **agent → our app**, never app → agent.
- The model comes from the **AI Gateway**: OpenAI-compatible chat completions at `${ASTRO_GATEWAY_URL}/v1/chat/completions`,
  Bearer `ASTRO_GATEWAY_API_KEY`, both injected into the agent container (no provider key).

```bash
node --test astropods/                       # 4 tests, no deps, no network
cd astropods
ast login && ast spec validate               # fix anything it reports; RFC-1 is the source of truth
ast blueprint push promise-concierge
ast blueprint deploy promise-concierge --var PROMISE_API_URL=https://<your-render-app>.onrender.com
ast agent list                               # status "running" -> open the launch URL (sign-in required by default)
```
Then set `ASTROPODS_AGENT_URL` (the launch URL) and `CAP_ASTROPODS=1` so the home page links to it.
Use the Astropods dashboard (usage, tool calls, latency, traces) as the observability screenshot.
Not verified here: tool calling through the gateway (the docs say "OpenAI-compatible"); if the first run shows no tool calls, check
https://docs.astropods.com/ai-gateway/chat for the supported request fields.
