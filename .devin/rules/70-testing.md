---
trigger: always_on
description: Test conventions with a copyable table-test example, what must be tested, and what must not be mocked
---

# Testing

Runner: `vitest`. Tests live next to the file: `lib/foo.ts` → `lib/foo.test.ts`. Run `npx vitest run lib/foo.test.ts`.

## What MUST have a test

| Change | Test that proves it |
|---|---|
| New/changed reason code or rule in `decide()` | a new row in `TABLE` in `lib/verdict.test.ts` (both sides of any boundary) |
| New money parsing/formatting | rows in `lib/money.test.ts` incl. the bad inputs that must throw |
| New PayPal response shape | a row in `lib/paypal.test.ts` for `normalizeCapture` (pure) |
| New trace helper/reducer | a case in `lib/sse.test.ts` |
| New agent timeout/budget rule | a case in `lib/agent/budget.test.ts` |

## The table-test shape (copy it)

```ts
import { describe, expect, it } from "vitest";

// name, input, expected. One row per behaviour. Boundaries get TWO rows (just inside, just outside).
const TABLE: [string, number, string][] = [
  ["open one ms before end", END - 1, "WINDOW_OPEN"],
  ["closed exactly at end",  END,     "WINDOW_EXPIRED"],
];
describe("thing", () => {
  it.each(TABLE)("%s", (_name, nowMs, want) => {
    expect(computeVerdict({ terms, fact: { kind: "none" }, nowMs }).reason).toBe(want);
  });
});
```

## Rules

- **Do not mock `computeVerdict`.** It is pure; call it. Do not mock `Date`: pass `nowMs`.
- Do not hit the network or the database in unit tests. Extract the decision into a pure function instead.
- A test that was green and is now red is a **finding**, not an annoyance. Never delete or `.skip` it to get green.
  If it is genuinely obsolete, say which and why in the commit body.
- Flaky? Run it 3 times, report the pattern, fix the cause. Do not retry silently.
- Assert on the thing the user sees: reason code, consequence, state. Not on internal call counts.
