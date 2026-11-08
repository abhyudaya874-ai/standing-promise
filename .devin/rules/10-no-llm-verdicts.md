---
trigger: always_on
description: Determinism contract for computeVerdict, the Fact union, and the closed reason-code set
---

# No model in the verdict path

A judge can call `computeVerdict` twice and diff the output. It must be byte-identical.

Why `nowMs` (an integer) and not a `Date`, and why there are world conditions: see `docs/DECISIONS.md`.

## The real shape (copy this, do not reinvent it)

```ts
// lib/verdict.ts
// @deterministic — same input, same output, no side effects.
export type Fact =
  | { kind: "observed"; observedMinor: number; currency: string }
  | { kind: "none" }
  | { kind: "unavailable" };

export interface VerdictInput { terms: Terms; fact: Fact; nowMs: number }
export function computeVerdict(input: VerdictInput): Verdict
```
`Verdict = { kind, reason, consequence, diag }`. `reason` is a `ReasonCode`. There is no prose field. Ever.

## Banned inside `lib/verdict.ts`

`import` (the file imports nothing), `fetch`, `Date.now()`, `new Date()`, `Math.random`,
`process.env`, `console.*`, `crypto.randomUUID`, `async`/`await`.
`scripts/check-invariants.mjs` and a write-time hook both enforce this.

## Allowed

Integer arithmetic, `Number.isInteger`, an exhaustive `switch` on `fact.kind`, throwing an `Error` on bad terms.

## "Can I…?" table

| Question | Answer |
|---|---|
| Can the verdict read the current time? | No. The route reads `Date.now()` once and passes `nowMs`. |
| Can I log a debug value from inside it? | No. Put it in `verdict.diag` and return it. |
| Can the LLM explain a verdict? | Yes, in `lib/agent/agents/explainer.ts`, after the verdict is final, with a template fallback. |
| Can an agent call `computeVerdict`? | No. The checker fails if `lib/agent/**` mentions it. Agents return a `Fact`. |
| What if the evidence could not be read? | The observer returns `{ kind: "unavailable" }` → `FACT_MISSING` → `WAIT`. Never `RELEASE`. |
| Can I add a field to `Verdict`? | Yes if it is a serialisable fact about the decision (put diagnostics in `diag`). Update the UI card in the same slice. |
| Can I add a reason code? | Only via `.devin/workflows/add-reason-code.md`. It is a 4-place change. |

## Reason codes are a closed set

```ts
export const REASON_CODES = ["AMOUNT_MET","AMOUNT_SHORT","WINDOW_EXPIRED","WINDOW_OPEN","FACT_MISSING","CURRENCY_MISMATCH"] as const;
const OUTCOME: Record<ReasonCode, { kind: VerdictKind; consequence: Consequence }> = { ... };
```
`Record<ReasonCode, …>` makes a new code a **compile error** until it has an outcome row. That is the
safety net. Follow the TypeScript errors; each one is a place you still have to edit.

A new code touches exactly four places, and the checker fails if they disagree:
1. `REASON_CODES` and `OUTCOME` in `lib/verdict.ts`
2. a row in `TABLE` in `lib/verdict.test.ts`
3. a row in the reason-code table in `docs/ARCHITECTURE.md`
4. a sentence in `FALLBACK` in `lib/agent/agents/explainer.ts` (also a compile error if missing)

## The LLM's only jobs

Copy on the page, and one optional sentence about an already-computed verdict. If the model is down or
there is no key, the page renders and the verdict stands.
