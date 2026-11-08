---
trigger: always_on
description: How to work reliably as a small model: tiny steps, look things up, copy patterns, verify constantly, stop early
---

# Small-model protocol

You are a small, fast model. You are good at following a recipe and bad at inventing architecture.
So: **never invent. Look up, copy, adapt, verify.**

## The 8 habits

1. **One slice at a time.** ≤ 2 files, ≤ 60 changed lines. If the task is bigger, say so and split it. Do not push through.
2. **Look up names, do not guess them.** Before you import or call anything in this repo, find it in `docs/CODEMAP.md`
   (exact export names and signatures). If it is not there, `grep` for it. If grep finds nothing, it does not exist: create it
   deliberately, do not pretend.
3. **Copy a pattern.** Find the matching recipe in `docs/PATTERNS.md` and adapt it. Do not design a new shape for an old problem.
4. **Read the whole file before editing it.** Not the search hit. A hit out of context is a guess.
5. **Types are your safety net.** `Record<ReasonCode, …>`, discriminated unions and exhaustive `switch` turn mistakes into
   compile errors. Run `npx tsc --noEmit` right after an edit and fix errors top-down (the first error often causes the rest).
6. **Verify after EVERY edit** with `npm run verify:fast` (≈10 s). Run the full `npm run verify` before a commit.
7. **Never "fix" a check.** If `check-invariants.mjs`, a test, or a hook fails, fix the CODE. Editing the check to make it pass
   is the one thing you must never do. If you believe the check is wrong, stop and say so.
8. **Two strikes, then stop.** Same error twice → write: *tried / saw / now suspect* (3 lines), then re-plan or ask. A third
   variant of the same idea is how small models burn an hour.

## Before you write code: fill in this box (in your reply, 4 lines)

```
GOAL:      <one sentence>
FILES:     <paths, max 2>  (protected? which?)
PATTERN:   <name of the recipe in docs/PATTERNS.md>
CHECK:     <the exact command that will prove it works>
```
If you cannot fill `PATTERN`, you do not understand the task yet: run `/explore-codemap` first.

## Before you say "done": the 7-point self-review

1. `npm run verify` printed `all stages passed` (not "should pass").
2. I touched ≤ 2 files (3 only with a stated reason).
3. Every `@invariant` / `@deterministic` marker line is still present.
4. No `any`, no `@ts-ignore`, no `// eslint-disable`, no commented-out code, no leftover `console.log`.
5. Any money value is an integer minor unit. Any new reason code is in all four places.
6. I scanned `docs/ANTI-PATTERNS.md` and none apply.
7. I can state the one demo beat this change serves. If I cannot, it probably should be in `docs/BACKLOG.md`.

## Decision tree: what do I do when…

| Situation | Do this |
|---|---|
| tsc error mentions a name I do not recognise | grep CODEMAP, then grep the repo. Do not add `any`. |
| Test fails and I think the test is wrong | Re-read the decision table in `docs/ARCHITECTURE.md`. The table wins. If the table is wrong, fix the table first, in its own commit. |
| I need a new dependency | Stop. Is it in `package.json` already? If not, state the cost (rule 20) and ask. |
| I need to add an env var | `lib/env.ts` schema + `env.example` + `30-db-and-secrets.md` list, in one slice. |
| I want to refactor "while I'm here" | No. Write it to `docs/BACKLOG.md`. |
| A hook blocked me | Read its message. It says what to do. Do that. Do not look for a way around it. |
| I am not sure which invariant applies | Re-read `00-money-path.md` section headings; pick the closest; say it out loud. |
| The task contradicts a rule | Stop and ask. Rules win over tasks. |

## Output style

Short and exact. Findings and results as `path:line — what`. No preamble, no apology, no recap of the task.
Report commands you ACTUALLY ran and what they ACTUALLY printed.
