---
trigger: always_on
description: Rules for the runtime subagents in lib/agent: what they may do, the fixed graph, and how to add one
---

# Runtime agent layer (the app's own subagents)

These are different from the `.devin/agents/*` profiles that build the app. They run INSIDE the product at
request time. They gather, check and explain. **They never decide.**

## Non-negotiables

1. No file under `lib/agent/**` imports or mentions `computeVerdict`. (`check-invariants.mjs` fails otherwise.)
2. No agent builds a `Verdict`. Observer returns a `Fact`; the route calls `computeVerdict`.
3. Every agent takes an `AbortSignal` and checks it after each await. Every agent has a cap in `PROFILES`.
4. Failure policy is data, not code: `onFailure: "abort" | "degrade" | "ignore"` in `lib/agent/registry.ts`.
   - guard → `abort` (cannot load the promise: stop)
   - observer → `degrade` (blind → `Fact: unavailable` → `FACT_MISSING` → WAIT; **never** RELEASE)
   - reconciler, explainer, archivist → `ignore`
5. Trace events are append-only. Same `id` = the new event supersedes the old one in the panel. Never mutate.
6. Any external call goes through `traced(emit, name, args, fn)` so it appears in the panel. If the call returns a
   failure *value* (not a throw), throw inside `fn` so the panel shows red.
7. Retries reuse the same idempotency key. Capture is never auto-retried (see `lib/capture.ts`).
8. The graph is fixed in code (`Cycle.gather` / `Cycle.decorate`). No agent chooses the shape. Adding a node is a code edit.

## The graph

```
guard ─▶ observer ─▶ reconciler ─▶ [route: computeVerdict → persist → consequence] ─▶ explainer ┐
                                                                                        archivist ┴ (parallel, best-effort)
```
Why `observer` before `reconciler`: the reconciler compares local capture rows with the provider status the observer read.

## Skeleton of an agent (copy this)

```ts
// lib/agent/agents/<name>.ts
import type { AgentCtx } from "../types";

/** One sentence: what it reads, what it returns, that it never decides. */
export async function runExample(ctx: AgentCtx, signal: AbortSignal): Promise<{ note: string }> {
  // 1. read (DB via getDb(), or network via traced(...))
  // 2. if (signal.aborted) throw new Error("example aborted");   // after every await
  // 3. return typed DATA, never a string blob and never a Verdict
  return { note: "ok" };
}
```
Then follow `.devin/workflows/add-subagent.md` (id → profile → call site → trace → test with the network dead).

## Testing an agent

Pure parts get unit tests (see `budget.test.ts`, `paypal.test.ts`). For DB/network parts: extract the decision into a pure
function and test that (see `normalizeCapture`). Always test the failure path: what does the agent do when its call throws?
