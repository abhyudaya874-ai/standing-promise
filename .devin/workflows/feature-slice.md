---
description: Build one slice end to end: map, declare, build, gate, review, land
argument-hint: "<slice>"
---

# Feature slice: $ARGUMENTS

## Phase 1: map
`/explore-codemap` on the entry point, even when it looks obvious. The obvious slice is where the invariant gets missed.

## Phase 2: declare (4 lines, in your reply)
```
GOAL / FILES (max 2, protected?) / PATTERN (docs/PATTERNS.md) / CHECK (command)
```
More than 2 files? Run `/orchestrate` instead.

## Phase 3: build
`/ship-slice`. Check the seven things that break this app before you report.

## Phase 4: gate
`npm run verify:fast` after each edit, `npm run verify` at the end. Red is red: never proceed on a known failure.

## Phase 5: review
`/review-diff`. `rework` sends you back to Phase 2, not Phase 3.

## Phase 6: land
Commit in house format (rule 40). Add anything deferred to `docs/BACKLOG.md`.

## Worked example: "show the verdict reason in the page title"

```
GOAL:    document.title shows the latest reason code on /p
FILES:   app/p/page.tsx (protected: page-renders-without-network-or-llm)
PATTERN: "Server component reads the DB" (docs/PATTERNS.md #11)
CHECK:   npm run verify:fast
```
Build: add `export async function generateMetadata` that reads the same promise row via `getDb()` (DB only, no network).
Gate: verify:fast green; marker line untouched. Commit: `ui: reason code in page title` / Why: judge sees outcome in the tab / Files: 1 of 4.
