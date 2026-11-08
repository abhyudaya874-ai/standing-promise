---
name: ship-slice
description: Implement one slice against the protected files with the determinism, idempotency and snapshot invariants enforced
argument-hint: "<slice description>"
agent: promise-editor
triggers:
  - user
  - model
---

Ship this slice: $ARGUMENTS

## Before writing (one line each, in your reply)

- Protected files touched, and the invariant at stake
- Fifth file needed? Why? (support files in rule 20 are pre-approved)
- PATTERN from docs/PATTERNS.md

## Then

1. Read target files in full.
2. Verdict involved? `now` is a parameter, inputs are serialisable, vendor data arrives as `world`.
3. A write involved? Order is event -> capture row -> state; idempotency key is `promise_id + attempt`.
4. A vendor involved? Follow rule 80: `isOn` -> `guard` -> timeout -> zod -> `minorFromJson` -> flag.
5. Smallest change, markers intact.
6. `npx tsc --noEmit`, then `npm run verify:fast`.
7. Report with the editor contract.

## The seven things that break this app (check ALL before you report)

1. `fetch` / an adapter import inside `lib/verdict.ts`
2. `Date.now()` read inside `computeVerdict` instead of passed in
3. A float on the money path (`* 100`, `toFixed`, `parseFloat`)
4. A capture without the unique-claim insert first
5. A new reason code missing from one of the four places
6. A vendor call outside `guard()` / a vendor failure that can become RELEASE
7. A user-typed URL fetched without `assertPublicHttpUrl`
