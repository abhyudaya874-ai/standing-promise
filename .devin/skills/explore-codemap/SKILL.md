---
name: explore-codemap
description: Map how a symbol, route, or data flow actually works before changing it
argument-hint: "<symbol or flow>"
agent: promise-scout
triggers:
  - user
  - model
---

Map this: $ARGUMENTS

Return a call map, not a summary. Start at `docs/CODEMAP.md`, then confirm in the real files.

## Steps

1. Locate the entry point (grep the exact symbol).
2. Read each file on the path in full.
3. One level of callers, one level of callees. Stop.
4. Note every side effect: DB write, network call, clock read, env read.
5. Flag anything that breaks if the entry point is called twice.

## Output

```
ENTRY: path:line
PATH: <ordered path:line list>
SIDE EFFECTS: <list, or "none">   (state "none" explicitly)
REENTRANCY: safe | unsafe — <why>
TOUCHES: <which protected files>
```

## Example: /explore-codemap runSettle

```
ENTRY: app/api/promise/route.ts:118 runSettle
PATH: route.ts:118 -> orchestrator.ts:55 Cycle.gather -> guard.ts:12 -> observer.ts:10 -> resolver.ts:34 -> reconciler.ts:12
      -> lib/verdict.ts:131 computeVerdict -> lib/events.ts:25 logEvent -> lib/capture.ts:46 capturePromise
SIDE EFFECTS: DB reads (guard, resolver, reconciler); DB insert (snapshot, verdict event, capture claim, capture events);
              network (PayPal getOrder/captureOrder, Channel3, KERNEL, Zapier)
REENTRANCY: safe — capture claim is unique(promise_id, attempt); guard short-circuits an existing capture
TOUCHES: route.ts (protected), verdict.ts (protected), schema.ts (read)
```
(Line numbers illustrative. Yours must be real.)

## Hard limits

- Cite lines or it did not happen. "No side effects" must be asserted explicitly.
- Crosses into `node_modules`: name the package and stop.
