# Runtime agent layer

The product runs its own subagents. They gather, check, and explain. **They never decide.**

## The split

`computeVerdict` is pure and synchronous. Everything a network call or an LLM does sits on either side of it.
A judge can call the verdict twice and diff, and the demo survives any vendor dying.

## The graph (fixed in code: `Cycle.gather` / `Cycle.decorate`)

```
guard ─▶ observer ─▶ resolver ─▶ reconciler ─▶ [route: computeVerdict → persist → consequence] ─▶ explainer ┐
 abort    degrade     degrade      ignore                                                          nudger    ┼ parallel,
                                                                                                   archivist ┘ best-effort
```
observer = PayPal evidence (`Fact`). resolver = world evidence (`ConditionFact`) + a frozen snapshot row.
reconciler needs the observer's provider status, hence the order.

## Profiles and caps (`registry.ts`)

| Agent | Cap | Network | onFailure | Retries |
|---|---|---|---|---|
| guard | 0.4 s | no | abort | 0 |
| observer | 3 s | PayPal | degrade (`Fact: unavailable`) | 1 |
| resolver | 9 s | Channel3, KERNEL | degrade (manual snapshot → `unavailable`) | 0 |
| reconciler | 1 s | no | ignore | 0 |
| explainer | 4.5 s | LLM, Elastic (optional) | ignore (template) | 0 |
| nudger | 4 s | Zapier | ignore (in-app banner) | 0 |
| archivist | 3.5 s | Elastic (optional) | ignore | 0 |

Cycle budget 16 s (wall clock). Exhaustion fails closed before capture and is invisible after it.

## Non-negotiables

1. No agent imports or mentions `computeVerdict`. No agent builds a `Verdict`.
2. Blind spot → `{kind:"unavailable"}` → `FACT_MISSING` → WAIT. Never RELEASE.
3. Every agent takes an `AbortSignal` and checks it after each await. `withTimeout` rejects even if it does not.
4. Every external call goes through `traced(emit, name, args, fn)`; throw inside `fn` on a failure VALUE so the row is red.
5. Vendors only via `lib/integrations/*`; the resolver's `attempt()` logs `degraded` events.
6. Snapshots are written BEFORE the verdict (`@invariant:snapshot-before-verdict`).
7. Trace events are append-only; same `id` supersedes.
8. Adding an agent: `.devin/workflows/add-subagent.md`.
