---
name: orchestrate
description: Break a multi-file or multi-unknown task into verified units and run them through the promise-* subagents
argument-hint: "<goal>"
model: swe
triggers:
  - user
---

Coordinate this goal: $ARGUMENTS

## Steps

1. Restate the goal in ONE sentence. Cannot? Ask.
2. List the unknowns. Each becomes a `promise-scout` question (max 3).
3. List the units. Each names its files and its check.
4. Run the scouts in parallel. Read what comes back.
5. Revise the plan against the findings. If a scout contradicts the plan, the plan loses.
6. Hand each unit to `promise-editor`, serially unless files are disjoint.
7. `promise-verifier` on the whole tree (`npm run verify`).
8. `promise-reviewer` on the staged diff.
9. Report with the oracle output contract.

## Worked example: "add Zapier nudges"

```
GOAL: when a verdict is UNMET and the payer has an email, send a friendly nudge (in-app banner if Zapier is off).
UNKNOWNS: (1) what tool name/args does our Zapier MCP expose?  (2) where does decorate() run agents?
 -> scout 1: run `node scripts/zapier-tools.mjs`, report names + schemas (needs the human's token: ASK)
 -> scout 2: lib/agent/orchestrator.ts decorate()
UNITS:
 U1 lib/integrations/zapier.ts + zapier.test.ts   verify: npx vitest run lib/integrations/zapier.test.ts
 U2 lib/agent/agents/nudger.ts + registry entry    verify: npm run verify:fast
 U3 orchestrator.decorate wiring                   verify: verify:fast, then Postman "settle" with CAP_ZAPIER=0 shows the banner
```

## Rules

- A unit with no check is not a unit.
- Never hand the reviewer an unverified tree.
- Four subagents is the ceiling. Past that, cut scope and say so.
