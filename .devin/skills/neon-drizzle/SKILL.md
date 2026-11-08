---
name: neon-drizzle
description: Schema changes, migration review, and branch discipline on Neon
argument-hint: "<change>"
allowed-tools:
  - read
  - grep
  - glob
  - exec
triggers:
  - user
---

Change: $ARGUMENTS. Follow `.devin/workflows/schema-change.md` (it has the full worked example). Summary:

1. Work on a Neon BRANCH database. `main` is the demo database.
2. Edit `db/schema.ts` (keep every marker). Money is `integer` + `char(3)`.
3. `npx drizzle-kit generate`, then READ the SQL and classify it: additive | narrow | rewrite | drop.
4. `npx drizzle-kit migrate` on the branch, then `npm run verify:fast`.
5. Only after verify is green, apply to `main`, in a separate commit from any UI change.

## Rules

- `drizzle-kit push` is blocked by a hook (it can drop columns without a migration file to review).
- Every new table: uuid id default `gen_random_uuid()` + `created_at`; every FK indexed.
- `capture` keeps `unique(promise_id, attempt)`. `promise_event` and `condition_snapshot` are insert-only.
- jsonb columns get a TS type via `.$type<…>()` imported with `import type`.

## Output

```
SCHEMA: <what changed>
SQL: drop | narrow | rewrite | additive
BRANCH: verified | not verified
MAIN: applied | pending
```
