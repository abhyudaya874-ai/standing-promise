---
description: Add or split a reason code in all four places. Full worked example with real code
argument-hint: "<CODE_NAME and when it fires>"
---

# Add a reason code: $ARGUMENTS

A code lives in FOUR places. The checker and the compiler fail until all four agree. Follow the errors.

| # | Place | What |
|---|---|---|
| 1 | `lib/verdict.ts` | `REASON_CODES`, `OUTCOME` row, and the branch in `decide`/`decideCondition` |
| 2 | `lib/verdict.test.ts` | at least one `TABLE` row (and update a row if you are SPLITTING a code) |
| 3 | `docs/ARCHITECTURE.md` | the reason-code table AND the decision table |
| 4 | `lib/agent/agents/explainer.ts` | a sentence in `FALLBACK` (compile error if missing) |

Order: write the TEST row first (it fails), then verdict.ts, then docs, then explainer.

## Worked example: split "cheap but out of stock" out of CONDITION_PENDING

Today a product at the right price but out of stock returns `CONDITION_PENDING`. We want a code that says why: `CONDITION_OUT_OF_STOCK`.

**1. Test first** (`lib/verdict.test.ts`): change the existing row and add a closed-window row.
```ts
// was: ["CONDITION_PENDING", mk(price), paid, {kind:"product", priceMinor:100, currency:"USD", inStock:false}, OPEN, "indeterminate","WAIT"],
["CONDITION_OUT_OF_STOCK", mk(price), paid, { kind:"product", priceMinor:100, currency:"USD", inStock:false }, OPEN,   "indeterminate", "WAIT"],
["CONDITION_UNMET",       mk(price), paid, { kind:"product", priceMinor:100, currency:"USD", inStock:false }, CLOSED, "unmet",         "RELEASE"],
```
`npx vitest run lib/verdict.test.ts` fails (code does not exist yet). Good.

**2. `lib/verdict.ts`**
```ts
export const REASON_CODES = [ /* …existing… */ "CONDITION_UNMET", "CONDITION_OUT_OF_STOCK" ] as const;

const OUTCOME = { /* …existing… */ CONDITION_OUT_OF_STOCK: { kind: "indeterminate", consequence: "WAIT" } };

// in decideCondition, case "price_at_most":
if (world.priceMinor <= c.ceilingMinor && !world.inStock) return closed ? "CONDITION_UNMET" : "CONDITION_OUT_OF_STOCK";
if (world.inStock && world.priceMinor <= c.ceilingMinor) return "CONDITION_MET";
return closed ? "CONDITION_UNMET" : "CONDITION_PENDING";
```
`npx tsc --noEmit` now lists the remaining places (the `FALLBACK` Record). 

**3. `docs/ARCHITECTURE.md`**: add a row to BOTH tables:
```
| `CONDITION_OUT_OF_STOCK` | payment fine, price at or under the ceiling, but the product is out of stock; window open |
| observed | open | ≥ | price ≤ ceiling but out of stock | `CONDITION_OUT_OF_STOCK` | indeterminate | WAIT |
```
(Only the first table is parsed by the checker; keep both in sync anyway.)

**4. `explainer.ts`**
```ts
CONDITION_OUT_OF_STOCK: "The price is right but the item is out of stock, so we are still waiting.",
```
Also add the code to the `TONE` map in `components/studio/widgets/verdict-pill.tsx` (amber).

**5. Gate**: `npm run verify`. Commit: `verdict: add CONDITION_OUT_OF_STOCK` / Why: judge asks why a cheap item did not capture / Files: 1 of 4.

## Do NOT

- Add a code only in `verdict.ts` and "fix the checker". Add a prose `reason`. Branch on the code in `route.ts` (the consequence lives in `OUTCOME`).
