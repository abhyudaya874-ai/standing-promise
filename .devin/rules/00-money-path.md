---
trigger: always_on
description: The four protected files, their invariants, and what each invariant looks like in real code
---

# Money path

These four files are the product. Every edit is a contract change.

| Protected file | Owns | Markers it carries (never delete the line) |
|---|---|---|
| `lib/verdict.ts` | the pure verdict | `@deterministic`, `@invariant:closed-reason-codes`, `@invariant:verdict-carries-its-consequence` |
| `db/schema.ts` | `promise`, `promise_event`, `capture` | `@invariant:money-integer-minor-units`, `@invariant:append-only-events`, `@invariant:capture-unique-per-attempt` |
| `app/api/promise/route.ts` | the only write endpoint (ops: create, settle, manual_fact, reschedule) | `@invariant:one-step-per-request` |
| `app/p/page.tsx` | the promise surface | `@invariant:page-renders-without-network-or-llm` |

A marker is a comment line like `// @invariant:append-only-events`. A hook blocks any edit that drops one.
If you think a marker is obsolete, change THIS file in the same commit and say why.

## The five invariants, right vs wrong

### 1. `computeVerdict` is referentially transparent
Time, evidence and terms arrive as arguments. Nothing else.
```ts
// RIGHT  (lib/verdict.ts)
export function computeVerdict(input: VerdictInput): Verdict {
  const closed = input.nowMs >= input.terms.windowEndsAtMs;   // nowMs was passed in
```
```ts
// WRONG: reads the clock, so the same input gives different verdicts tomorrow
const closed = Date.now() >= input.terms.windowEndsAtMs;
```

### 2. The route does one thing per request: validate → compute → persist → capture
The verdict carries its own consequence. The route looks it up; it never branches on the verdict.
```ts
// RIGHT  (app/api/promise/route.ts)
const consequences: Record<Consequence, (c: SettleCtx) => Promise<Outcome>> = {
  CAPTURE: capturePromise, RELEASE: releasePromise, WAIT: waitPromise,
};
const outcome = await consequences[verdict.consequence](sc);
```
```ts
// WRONG: business logic leaking into the handler, and a new reason code is silently ignored
if (verdict.reason === "AMOUNT_MET" || verdict.reason === "AMOUNT_SHORT") { await capture(...) }
```

### 3. Every state transition writes an event row before it returns
Order is always: **event → capture row → promise.state**. See `record()` in `lib/capture.ts`.
```ts
// RIGHT
await logEvent(c.promiseId, c.attempt, "released", {});
await setState(c.promiseId, "released");
```
```ts
// WRONG: state changed, no event. After a crash the log lies about what happened.
await setState(c.promiseId, "released");
```

### 4. Capture is idempotent on `promise_id + attempt`
Claim the slot in the DB first; PayPal is called only by whoever won the claim.
```ts
// RIGHT  (lib/capture.ts)
const claimed = await db.insert(capture).values({ promiseId, attempt, requestId, status: "pending" })
  .onConflictDoNothing().returning({ id: capture.id });
if (claimed.length === 0) return resume(...);     // someone else already owns this attempt
```
```ts
// WRONG: check-then-act race. Two tabs both see "no capture yet" and both charge.
const existing = await db.select()...; if (!existing) await paypal.captureOrder(...)
```
The PayPal `PayPal-Request-Id` is always `${promiseId}:${attempt}` (same key on every retry of an attempt).

### 5. Money is integer minor units
```ts
// RIGHT: string -> integer at the boundary, integer -> string at the boundary (lib/money.ts)
const amountMinor = parseMinor(body.amount, body.currency);     // "10.50" -> 1050
const value = formatMajor(1050, "USD");                         // "10.50"
```
```ts
// WRONG: any of these on the money path. check-invariants.mjs fails the build.
const minor = Math.round(parseFloat(amount) * 100);   price.toFixed(2);   numeric("amount")
```

## Editing protocol (do this every time, in this order)

1. Say in ONE sentence which invariant is at stake. Example:
   `Touching route.ts: invariant 2 (no branching on the verdict). I am adding an op to the Body union, not touching runSettle.`
2. Read the whole file. Not the hunk.
3. Make the smallest change. Keep every marker line.
4. `npm run verify:fast` after each edit; `npm run verify` before commit.

## Walkthrough: "add a 10-minute grace period after the window closes"

This LOOKS like a one-line change in `decide()`. It is a contract change.
1. Invariant at stake: 1 (inputs only) and the closed reason-code set.
2. Do NOT add `+ 10 * 60_000` inside `decide()`. Put it in the terms: add `graceMs: number` to `Terms`.
3. Update `db/schema.ts` (column), `route.ts` create op (value), `guard.ts` (reads it), `verdict.ts` (uses `windowEndsAtMs + graceMs`).
4. That is 4 protected/support files and a schema change → it does not fit one slice. Run `/orchestrate`, split: (a) schema + migration, (b) verdict + test rows, (c) guard + route wiring.
5. Add test rows at the boundary: `END + grace - 1` open, `END + grace` closed.
