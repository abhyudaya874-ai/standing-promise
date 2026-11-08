---
description: Studio Agent Framework: a custom 'promise-analyst' agent next to the built-in lead agent, via our own chat adapter and a key-safe proxy
---

# Studio agent

Everything is in the reference code, including the LLM adapter (v2.0 left that as homework; it is now written and unit-tested):

| File | Role |
|---|---|
| `components/studio/chat-adapter.ts` | `chatAdapter({endpoint, model})`: an `AgLlmAdapter` for any OpenAI-compatible **chat completions** endpoint. Pure mapping functions + a stream accumulator, tested in `chat-adapter.test.ts` |
| `components/studio/agent.ts` | `buildAi(adapter)`: two agents (the built-in `lead` + `promise-analyst`), one custom tool `replay_verdict` |
| `app/api/studio/llm/[...path]/route.ts` | server proxy: holds the key, forwards ONLY `chat/completions` |
| `components/studio/StudioBoard.tsx` | passes `ai={…}` when `NEXT_PUBLIC_STUDIO_AI=1` |

1. Pick a provider that speaks chat completions (any one):
   - OpenAI: `STUDIO_LLM_BASE_URL=https://api.openai.com/v1`, `NEXT_PUBLIC_STUDIO_MODEL=<a chat model>`
   - Anthropic's OpenAI-compatible endpoint: `STUDIO_LLM_BASE_URL=https://api.anthropic.com/v1` with your Anthropic key (check their compatibility page; tool calling is supported there)
   - The Astropods AI Gateway only issues keys to agents running on Astropods, so it is not usable for the Studio browser app.
2. `.env.local`: `STUDIO_LLM_API_KEY=…`, `CAP_STUDIO=1`, `NEXT_PUBLIC_STUDIO_AI=1`, `NEXT_PUBLIC_STUDIO_MODEL=…`.
3. Probe the proxy before trusting Studio:
   ```bash
   curl -s -N localhost:3000/api/studio/llm/chat/completions -H 'content-type: application/json' \
     -d '{"model":"<model>","messages":[{"role":"user","content":"say hi"}],"stream":true}' | head -5
   ```
   `data: {…}` lines mean the proxy + key work. A 503 means a missing env var; a 404 means the path was not `chat/completions`.
4. `/board`: the Studio chat panel appears. Try "build me a dashboard of verdicts by reason", then "why was promise <id> released?" (the analyst should call `replay_verdict` and quote the reason code).
5. `npx vitest run components/studio` keeps the mapping honest. If a provider rejects a request, add the failing payload as a test case in `chat-adapter.test.ts` first, then fix `toChatMessages` / `toToolChoice`.
6. Custom tool pattern: `api.defineAiTool({ name, description, params: s => s.object({...}), execute: async (args, ctx) => ctx.success(msg, data) })`; server work goes through a normal fetch to one of OUR routes.

Not verified: a live Studio session end to end (the adapter is verified against the real v3 types and with fakes, not against the running UI). If Studio ignores the stream and only reads `complete`, the output items still carry the tool calls.
The dashboard itself needs no LLM at all.
