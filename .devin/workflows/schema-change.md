---
description: Change the schema safely on a Neon branch, with a full worked example
argument-hint: "<change>"
---

# Schema change: $ARGUMENTS

1. **Branch.** Confirm `DATABASE_URL` is a Neon BRANCH, not `main`. `main` stops here.
2. **Edit** `db/schema.ts` only. Keep every marker. Money is `integer` + `char(3)`. New tables: uuid id, `created_at`, indexed FKs.
3. **Generate and read**: `npx drizzle-kit generate`, then open the new `.sql`. Classify: additive | narrow | rewrite | drop. A drop needs a stated reason.
4. **Apply to the branch**: `npx drizzle-kit migrate`. Then `npx tsc --noEmit` (the schema types flow into the code).
5. **Verify**: `npm run verify`. Green only.
6. **Promote**: only now apply to `main`. Never in the same commit as a UI change.

## Worked example: add `memo text` to `promise`

```ts
// db/schema.ts, inside the promise table
memo: text("memo"),                       // nullable: additive, no backfill needed
```
```bash
npx drizzle-kit generate --name promise_memo
cat drizzle/0001_promise_memo.sql
# ALTER TABLE "promise" ADD COLUMN "memo" text;      -> ADDITIVE. Say so out loud, then continue.
npx drizzle-kit migrate
npx tsc --noEmit        # route.ts create op still compiles (memo is optional)
npm run verify
```
Then (separate commit): add `memo: z.string().max(200).optional()` to `CreateBody` and insert it. Commit 1: `db: add memo column`. Commit 2: `api: accept memo on create`.

## What a dangerous migration looks like

```sql
ALTER TABLE "capture" DROP CONSTRAINT "capture_promise_attempt_uq";   -- NEVER. This is the idempotency guarantee.
ALTER TABLE "promise" ALTER COLUMN "amount_minor" SET DATA TYPE text;  -- money must stay integer
```
Revert the schema edit and regenerate. Do not apply either.
