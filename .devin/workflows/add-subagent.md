---
description: Add a runtime subagent to lib/agent with caps, failure policy, trace rows and a failure-path test
argument-hint: "<agent id and its one job>"
---

# Add a runtime subagent: $ARGUMENTS

1. **Decide the job in one sentence and whether it gathers or decorates.** Gathers facts BEFORE the verdict (goes in `Cycle.gather`), or decorates AFTER (goes in `Cycle.decorate`). It never decides.
2. `lib/agent/types.ts`: add the id to `SubagentId`; add its result type next to the others.
3. `lib/agent/registry.ts`: add a profile (`maxMs`, `retries`, `requiresNetwork`, `onFailure: abort | degrade | ignore`) and place it in `GRAPH`.
4. `lib/agent/agents/<id>.ts`: copy the skeleton from rule 60. Wrap external calls in `traced(...)`. Check `signal.aborted` after each await.
5. `lib/agent/orchestrator.ts`: call it with `this.run("<id>", (s) => runX(ctx, s, ...))` in the right phase, and handle `ok:false` per its `onFailure`.
6. Extract any decision into a pure function and unit-test it, including "what if my call throws".
7. `npm run verify`. Then settle once with the vendor flag OFF and once with a bad key and read the trace.

## Worked example: a `watcher` that logs how stale the world snapshot is (decorate phase, ignore)

```ts
// types.ts
export type SubagentId = /* …*/ | "watcher";
// registry.ts
watcher: { id: "watcher", title: "Snapshot watcher", maxMs: 800, retries: 0, requiresNetwork: false, onFailure: "ignore" },
// agents/watcher.ts
export function ageMinutes(capturedAtMs: number, nowMs: number): number {      // PURE, unit-tested
  return Math.max(0, Math.floor((nowMs - capturedAtMs) / 60_000));
}
export async function runWatcher(ctx: AgentCtx, signal: AbortSignal): Promise<{ ageMinutes: number | null }> {
  const [row] = await getDb().select({ at: conditionSnapshot.capturedAt }).from(conditionSnapshot)
    .where(eq(conditionSnapshot.promiseId, ctx.promiseId)).orderBy(desc(conditionSnapshot.capturedAt)).limit(1);
  if (signal.aborted) throw new Error("watcher aborted");
  return { ageMinutes: row ? ageMinutes(row.at.getTime(), ctx.nowMs) : null };
}
// orchestrator.decorate: add this.run("watcher", (s) => runWatcher(ctx, s)) to the Promise.all
```
Test: `ageMinutes(0, 59_999) === 0`, `ageMinutes(0, 60_000) === 1`, `ageMinutes(5, 0) === 0`.
