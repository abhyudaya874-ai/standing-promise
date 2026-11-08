# Architecture

## The one-line version

A payer commits an amount and, optionally, a world condition ("this product drops under X", "this page says Y").
When the evidence is in, a pure function returns `met` / `unmet` / `indeterminate` with a reason code **and its own
consequence** (`CAPTURE` / `RELEASE` / `WAIT`). The route performs that consequence against the PayPal sandbox.

**Vendors produce snapshots, never verdicts.** Channel3, KERNEL and manual entry are written to
`condition_snapshot` before the verdict runs. The verdict event stores its full input, so a replay recomputes the
same answer even though the world moved.

## Data flow (one `settle` request)

```
Browser ── POST /api/promise {op:"settle"} ──▶ route.ts            (response = SSE trace stream)
                                               │
   1. GATHER   Cycle.gather()                  │  guard ▶ observer ▶ resolver ▶ reconciler        (lib/agent/*)
                 observer  = PayPal evidence   │     Fact        (payment)
                 resolver  = world evidence    │     ConditionFact (Channel3 / KERNEL / manual) + snapshot row
   2. COMPUTE  computeVerdict(input)           │  pure, sync, no I/O                                (lib/verdict.ts)
   3. PERSIST  logEvent("verdict", {verdict, input})   event row BEFORE any side effect
   4. CONSEQUENCE  consequences[verdict.consequence](ctx)
                 CAPTURE ▶ claim capture row (unique promise_id+attempt) ▶ event ▶ PayPal capture ▶ record
                 RELEASE ▶ event ▶ state = released
                 WAIT    ▶ event ▶ state unchanged
   5. DECORATE Cycle.decorate()                │  explainer + nudger (Zapier) + archivist, best-effort
```

The route has five ops, all on `POST /api/promise`: `create`, `settle`, `manual_fact`, `reschedule`.
(`replay` is a read-only GET at `/api/verdict/replay`.) It stays the ONLY write endpoint. Render's workflow
tasks call it over HTTP instead of writing to the DB themselves.

## Why the verdict is a pure function

A judge can call it twice and diff (`GET /api/verdict/replay?promiseId=`). It survives the network being down:
a blind observer or resolver yields `unavailable`, which becomes `FACT_MISSING → WAIT`, **never** `RELEASE`.
Not seeing is not the same as "no".

## Decision table (the whole product)

Payment is judged first. The world condition is only consulted once the payment is fine.

| payment fact | window | amount vs committed | world condition | reason | kind | consequence |
|---|---|---|---|---|---|---|
| unavailable | any | — | — | `FACT_MISSING` | indeterminate | WAIT |
| observed (bad number) | any | non-integer or negative | — | `FACT_MISSING` | indeterminate | WAIT |
| observed | any | currency differs | — | `CURRENCY_MISMATCH` | indeterminate | WAIT |
| observed | open | < | — | `WINDOW_OPEN` | indeterminate | WAIT |
| observed | closed | < | — | `AMOUNT_SHORT` | unmet | RELEASE |
| none | open | — | — | `WINDOW_OPEN` | indeterminate | WAIT |
| none | closed | — | — | `WINDOW_EXPIRED` | unmet | RELEASE |
| observed | any | ≥ | none | `AMOUNT_MET` | met | CAPTURE |
| observed | any | ≥ | snapshot missing or wrong kind | `FACT_MISSING` | indeterminate | WAIT |
| observed | any | ≥ | price snapshot in another currency | `CURRENCY_MISMATCH` | indeterminate | WAIT |
| observed | any | ≥ | price ≤ ceiling AND in stock / page contains text | `CONDITION_MET` | met | CAPTURE |
| observed | open | ≥ | condition false | `CONDITION_PENDING` | indeterminate | WAIT |
| observed | closed | ≥ | condition false | `CONDITION_UNMET` | unmet | RELEASE |

Window is closed when `nowMs >= windowEndsAtMs` (closed exactly AT the end). The ceiling is inclusive.
Documented decisions: a met amount is `AMOUNT_MET` even after the window closed (observation time is not evidence yet);
a cheap but out-of-stock product is `CONDITION_PENDING`, not met.
Change a rule via the `add-reason-code` workflow, not by editing the switch.

## Reason codes (closed set)

| Code | Meaning |
|---|---|
| `AMOUNT_MET` | observed amount ≥ committed, same currency, no condition |
| `AMOUNT_SHORT` | window closed with observed amount < committed |
| `WINDOW_EXPIRED` | window closed and nothing was approved |
| `WINDOW_OPEN` | window still open, verdict deferred |
| `FACT_MISSING` | evidence unavailable, malformed or the wrong kind |
| `CURRENCY_MISMATCH` | an observed currency differs from the committed currency |
| `CONDITION_MET` | payment fine AND the world condition holds |
| `CONDITION_PENDING` | payment fine, condition not true yet, window open |
| `CONDITION_UNMET` | payment fine, condition never became true, window closed |

`scripts/check-invariants.mjs` fails the build if this table, `REASON_CODES` in `lib/verdict.ts`, and
`lib/verdict.test.ts` disagree.

## Storage

Four tables, all in `db/schema.ts`:

| Table | Role | Key constraint |
|---|---|---|
| `promise` | terms, payer, `condition` (jsonb), `state` (a projection of the log) | money = `integer` minor units + `char(3)` currency |
| `promise_event` | append-only log: `promise_id, attempt, kind, payload, created_at` | insert only. Never update/delete |
| `capture` | one row per capture attempt | `unique(promise_id, attempt)` is the idempotency guarantee |
| `condition_snapshot` | what a vendor saw, frozen: `source, fact, evidence_url` | insert only. Evidence URL (KERNEL replay) is never an input |

Event kinds are a closed set in `lib/events.ts`.
State machine of `promise.state`:

```
open ──CAPTURE ok──────▶ captured
open ──CAPTURE declined▶ declined ──retry (attempt+1)──▶ captured | declined | capture_pending
open ──CAPTURE timeout─▶ capture_pending ──poll says COMPLETED──▶ captured
open ──RELEASE─────────▶ released          (terminal)
open ──WAIT────────────▶ open              (unchanged)
open ──reschedule (drag)▶ open             (due date moves; only OPEN promises may move)
```

## Runtime agents

Fixed graph, no model chooses the shape. Full rules in `reference/lib/agent/README.md`.

| Agent | Network | On failure | Role |
|---|---|---|---|
| guard | no | abort | load promise + condition + payer, find an existing capture |
| observer | PayPal read | degrade → `Fact: unavailable` | payment `Fact` |
| resolver | Channel3 / KERNEL | degrade → manual snapshot → `unavailable` | world `ConditionFact` + snapshot row |
| reconciler | no | ignore | compare local capture rows vs provider status |
| explainer | optional LLM | ignore → template | one sentence about a final verdict |
| nudger | Zapier MCP | ignore → in-app banner | friendly reminder when a verdict is UNMET |
| archivist | no | ignore | append one `summary` row |

Nothing under `lib/agent/` may import or call `computeVerdict` (enforced by the checker).

## Integrations (see docs/INTEGRATIONS.md)

Eight capabilities behind flags (`CAP_*`) plus two build-time tools (APIMatic, Postman). Astropods is NOT in the request path: it hosts a concierge agent that calls our read-only endpoints.
Every adapter returns `AdapterResult` and runs inside `guard()`; every flag off leaves the product usable.

## Boundaries

- The LLM writes copy. It never decides, and the app works with no key at all.
- PayPal is reached only from `lib/paypal.ts` (observer, `lib/capture.ts`, create op).
- Vendors are reached only from `lib/integrations/*`, only from agents or read-only routes, never from `lib/verdict.ts`.
- Browser domains in the demo: `localhost:3000` (or the Render URL) and the PayPal sandbox approval page.
- Currency: payable currencies are `SUPPORTED_CURRENCIES` (USD, EUR, GBP, CAD, AUD, JPY). **INR is not payable**: PayPal ended domestic payments in India (2021). INR is still PARSEABLE, so an INR product from Channel3 is read fine and then yields `CURRENCY_MISMATCH` (WAIT). Demo in USD with a USD-priced product.
