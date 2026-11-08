# Standing Promise: Devin pack v2

Everything Devin needs to build **Standing Promise** (PayPal AI Hackathon, deadline Fri 13 Nov 2026 01:30 IST) with a **small model**
(Haiku 5.5 class), including all ten sponsors behind capability flags.

This is a pack, not the finished app: `.devin/` rules, skills, workflows and subagent profiles, hooks, mechanical checks,
docs, and `reference/` (working code that Devin copies into the app and builds on).

## Contents

| Path | What |
|---|---|
| `AGENTS.md` | entry point: five laws, read order, where things live |
| `.devin/rules/` | 00–80: money path, determinism, scope, DB/secrets, commits, **small-model protocol**, agent layer, testing, **integrations** |
| `.devin/agents/` | 5 build-time subagent profiles (scout, editor, verifier, reviewer, oracle) with example outputs |
| `.devin/skills/` | 13 skills (explore, ship, verify, review, orchestrate, paypal, neon, ui-trace, runtime-agents, integrations, …) |
| `.devin/workflows/` | 22 step-by-step procedures with worked examples (bootstrap, add-reason-code, add-subagent, schema-change, wire-* per vendor, demo-freeze, release-check…) |
| `scripts/hooks/` | guards: pinned installs, drizzle push, destructive git, protected markers, **no commit without a fresh verify** |
| `scripts/check-invariants.mjs` | 10 mechanical checks (pure verdict, reason codes in sync, no floats, INR not payable, agents never decide, adapters use guard(), sandbox only, no `any`, markers) |
| `docs/` | ARCHITECTURE, **CODEMAP**, **PATTERNS**, **ANTI-PATTERNS**, **DECISIONS**, PROMPTS, BOOTSTRAP, INTEGRATIONS, UI-SPEC, DEMO-SCRIPT, BACKLOG |
| `reference/` | verified code: verdict + tests, money, PayPal, capture, route, 7 runtime agents, vendor adapters, Studio board + widgets + LLM adapter, Bryntum timeline, Render workflow, Astropods concierge agent, Postman collection, initial migration |

## Day 1 (10 minutes)

```bash
# in an empty folder containing this pack
bash scripts/set-model.sh <your-haiku-model-id>      # pins every profile and skill to one model
# then in Devin:  /bootstrap      (follow docs/BOOTSTRAP.md)
```
Paste the session prompt from `docs/PROMPTS.md` at the start of every session.

## v2.1 fixes (open items from the v2.0 hand-off)
- **Astropods:** read RFC-1, Deploy and AI Gateway docs. A deployed agent is human-facing (not an API we can call), so it is now a hosted **Promise concierge** (port 80, AI Gateway, read-only tools into our app), tested. The app only links to it.
- **Zapier:** no more guessing argument names: the adapter reads the tool's own input schema and always sends a full `instructions`; wrong tool name degrades with the real tool list; `followUpQuestion` is treated as not sent.
- **Studio agent:** the LLM adapter is written (`chatAdapter`, OpenAI-compatible chat completions through a key-safe, single-route proxy) and unit-tested against the real v3 types.
- **Currency:** my earlier "INR works for domestic accounts" was wrong. PayPal does not process INR. Payable list excludes it; the checker enforces it.
- **Time / conditions:** deliberate design, now explained with reasoning and a way to change each in `docs/DECISIONS.md`.

## What changed from v1
- **Why a small model can use it:** exact signatures (`CODEMAP`), copyable recipes (`PATTERNS`), wrong→right pairs (`ANTI-PATTERNS`), and
  mechanical enforcement (hooks + `check-invariants.mjs`) instead of prose it might forget.
- **Fixed bugs found while building:** the budget helper recorded the epoch as "spent time"; the unique key made the archivist's
  second event row impossible; the write-guard blocked legitimate partial edits and the hooks silently passed without `jq`;
  `GET` with side effects; observer failure could become a RELEASE; `verify-gate.sh` had a `find` precedence bug.
- **Contract changes:** time is `nowMs` (integer) not `Date`; `Fact` is a 3-state union plus a `ConditionFact` for the world;
  the verdict carries its own `consequence`; capture idempotency lives in a `capture` table; the verdict event stores its input so it can be replayed.
- **Integrations corrected against the docs:** Channel3 auth is `x-api-key`; Zapier MCP needs the MCP handshake; Render Blueprints
  cannot define Workflows; AG Studio custom widgets need `dataMapping` + `form`; tools use `defineAiTool({execute})`; money never `* 100`.
