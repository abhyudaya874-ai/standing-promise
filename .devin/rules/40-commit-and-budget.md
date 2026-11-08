---
trigger: always_on
description: Commit format with good and bad examples, subagent budget for a small model, dated timebox, stop conditions
---

# Commits and budget

## Format

```
<area>: <imperative summary, <= 60 chars>

Why: <one sentence: the demo beat or the bug>
Verify: <command run and result>
Files: <n of 4 protected touched, or "none">
```
`area` is one of `verdict`, `api`, `ui`, `db`, `infra`, `docs`, `integration`. Anything else means the commit does too much.

### Good
```
verdict: add CURRENCY_MISMATCH reason code

Why: observer can see EUR on a USD promise; must WAIT, not capture.
Verify: npm run verify -> all stages passed
Files: 1 of 4 (lib/verdict.ts)
```
```
db: add memo column to promise

Why: composer needs a free-text memo (demo beat 0:25).
Verify: drizzle-kit generate (ADDITIVE), migrate on branch, npm run verify -> passed
Files: 1 of 4 (db/schema.ts)
```
### Bad (and why)
```
fix stuff                                    # no area, no why, no verify
verdict: add code and redesign trace panel   # two areas in one commit
ui: update page.tsx and route.ts and schema  # 3 protected files, no reason for each
```

## Never in one commit

- A schema change plus a UI change
- A dependency plus a refactor
- Two protected files plus a new file (unless pre-approved support)

## Budget (one small model does everything: keep every step small)

- Research in `promise-scout`, never in the main thread.
- One `promise-editor` per slice. Two in parallel only if they touch disjoint files.
- Max 4 subagents per `/orchestrate` plan, nesting depth 2.
- A slice is ≤ 2 files and ≤ 60 changed lines. Bigger → split it, do not push through.
- **Two failed attempts on the same error → STOP.** Write 3 lines: what you tried, what you saw, what you now think is wrong. Re-plan. Do not try a third variant of the same idea.

## Timebox (build days, IST)

| Day | Date | Exit criterion (green verify + this demo path works) |
|---|---|---|
| 1 | Fri 6 Nov | schema + verdict + tests green; `create` op makes a sandbox order |
| 2 | Sat 7 Nov | `settle` happy path: approve in sandbox → AMOUNT_MET → capture → event rows |
| 3 | Sun 8 Nov | idempotency + failure paths: double click, kill network, decline |
| 4 | Mon 9 Nov | trace panel + subagent cards streaming live |
| 5 | Tue 10 Nov | polish the demo beats, README, `.env.example` |
| 6 | Wed 11 Nov | FREEZE: `/demo-freeze`, bug fixes only |
| submit | Thu 12 Nov | `/release-check`, record, submit before 01:30 IST Fri 13 Nov |

A day that ends red did not happen. On day 6 only bug fixes land: no new surface.

## Stop conditions

- Verify red twice on the same file → re-plan.
- A dependency needs a new browser domain → escalate before installing.
- A protected file needs a new invariant → update `00-money-path.md` in the same commit.

## Where the integrations fit in the timebox

Money path first. Every vendor has a degraded path already, so none may block a day's exit criterion.
Day 3: Channel3 + KERNEL. Day 4: Studio board, Bryntum, Zapier. Day 5: Render, Postman, APIMatic log.
Elastic and Astropods only after the money path is green twice. Vendor work uses the `integration` area: `integration: <vendor> <what>`.
