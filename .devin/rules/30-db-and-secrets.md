---
trigger: always_on
description: Env handling, migrations with a worked example, Neon branches, and what may be committed
---

# Database and secrets

## Env

`.env.local` is the only env file (gitignored). `env.example` mirrors its keys with empty values (committed).
Never write `.env.local` without asking. Never print a secret.

```
DATABASE_URL=            # Neon BRANCH url while developing
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENV=sandbox       # the only accepted value
APP_URL=                 # blank = http://localhost:3000
ANTHROPIC_API_KEY=       # optional; blank = template explanations
```
Every key is validated in `lib/env.ts` (zod). Always read env through `getEnv()`, never `process.env.X` in app code.
A bad env is a readable startup error, not a runtime `undefined`.

## Sandbox only

PayPal host is `api-m.sandbox.paypal.com` (hard-coded in `lib/paypal.ts`). A live key or host is a bug even if it "works".
Hooks and `check-invariants.mjs` both catch `sk_live_`, `pk_live_`, `api.paypal.com`.

## Migration walkthrough (copy this exactly)

Task: add `memo text` to `promise`.

```bash
# 0. confirm you are on a branch DB, not main
node -e "console.log(new URL(process.env.DATABASE_URL).pathname)"     # should name the branch DB
# 1. edit db/schema.ts  (additive column)
#      memo: text("memo"),
# 2. generate
npx drizzle-kit generate
# 3. READ the new file in drizzle/. Classify it out loud.
```
Generated SQL you might see, and how to classify it:
```sql
ALTER TABLE "promise" ADD COLUMN "memo" text;          -- ADDITIVE: safe, proceed
ALTER TABLE "promise" DROP COLUMN "title";             -- DROP: STOP. State the reason or revert.
ALTER TABLE "promise" ALTER COLUMN "amount_minor" SET DATA TYPE bigint;   -- NARROW/REWRITE: say so, then proceed on the branch only
```
```bash
# 4. apply to the BRANCH
npx drizzle-kit migrate
# 5. typecheck + tests
npm run verify:fast
# 6. only after verify is green: apply to main (separate step, separate commit from any UI change)
```
Never `drizzle-kit push` (a hook blocks it). Never hand-write SQL into the migration journal.

## Table rules

- Every table: `id uuid primary key default gen_random_uuid()` + `created_at timestamptz default now()`.
- Every foreign key is indexed (a composite index that STARTS with the FK column counts).
- Money: `integer` minor units + `char(3)` currency. No `numeric`, no `real`.
- `promise_event` is insert-only. If you want to "fix" a row, append a new event instead.
- `capture` has `unique(promise_id, attempt)`. That constraint IS the idempotency guarantee. Never drop it.

## Neon

Develop on a branch database. `main` is the demo database; it stays clean until the day before the freeze.
Destructive resets go on a branch first, get verified, then get applied.
