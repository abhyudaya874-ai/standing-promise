---
description: Reproduce, isolate, fix, and prove a bug without guessing
argument-hint: "<symptom>"
---

# Triage: $ARGUMENTS

1. **Reproduce** with the smallest case. Cannot in one attempt? Write down what you tried and ask.
2. **Localise** by observation, not intuition: the trace panel, the event log (`promise_event`), `GET /api/verdict/replay`.
   Narrow to ONE file, then read that file in full.
3. **Classify**
   - *Mechanical* (typo, wrong prop, missing import): fix directly.
   - *Structural* (wrong type, missing column, wrong order): write the diagnosis in one sentence BEFORE editing.
   - *Invariant* (an `@invariant` was never true): fix the enforcement, not the symptom.
4. **Fix** the smallest change. One file unless the classification says otherwise.
5. **Prove**: the reproduction now passes, full `npm run verify`, and a regression test if it could come back.
6. **Record**: the commit body names the symptom and the root cause as separate sentences.

## Worked example: "settled twice, two capture events"

```
Reproduce:  Postman "settle" twice -> event log shows capture_started twice            (symptom)
Localise:   lib/capture.ts capturePromise. Read it in full. The claim insert is there.
Classify:   Invariant (idempotency). The unique constraint is the guarantee.
Diagnosis:  `db/schema.ts` capture table lost unique(promise_id, attempt) in a bad migration.
Fix:        restore the constraint in schema.ts + generate a migration (workflow schema-change). NOT a check in route.ts.
Prove:      second settle -> done {deduped:true}; capture table has 1 row; add Postman "settle again" test (already there).
```
