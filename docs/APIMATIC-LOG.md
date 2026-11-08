# APIMatic verification log — PayPal Orders integration

Plugin installed: `npx context-plugins install paypal` (2026-11-08). The plugin ships curated skills plus the
APIMatic-generated TypeScript SDK (`paypal@2.29.0`, installed to /tmp for verification only — NOT a runtime dep).
Its `sdk-map.md` + `map/operations/*.md` + `src/models/*.ts` are the contract source used below.

## Q1 — Orders v2 create order: intent CAPTURE + payment_source.paypal.experience_context

**Answer (SDK map `orders.md` → createOrder, model `order-request.ts`, `pay-pal-wallet-experience-context.ts`):**
`POST /v2/checkout/orders`, body `OrderRequest{ intent, purchase_units[], payment_source.paypal{ experience_context } }`.
`experience_context` (`PayPalWalletExperienceContext`) fields: `return_url`, `cancel_url`, `brand_name`,
`landing_page`, `user_action`, `shipping_preference`, `contact_preference`, `shipping_detail`.
Headers include `PayPal-Request-Id`; SDK also mints `Idempotency-Key` per call.

**Diff vs `lib/paypal.ts` `createOrder`:** MATCH, no change.
We send `intent:"CAPTURE"`, `purchase_units[0].amount{currency_code,value}` (value via `formatMajor`,
never a float), `experience_context{return_url,cancel_url,user_action:"PAY_NOW",shipping_preference:"NO_SHIPPING"}` —
all declared fields. `PayPal-Request-Id: create:${promiseId}` prevents duplicate orders on retry.
Proven live: orders `3CB243834H9187224`, `542945463M9867005`, `58F9829336705074L`, `2RP16289XS0658214`,
`9H657479EK337823N`, `45P62953KE683093K` all created in sandbox.

## Q2 — Orders v2 capture response shape + declined-instrument error issues

**Answer (SDK map → captureOrder, models `order.ts`, `error.ts`, `error-details.ts`):**
`POST /v2/checkout/orders/{id}/capture`, optional `OrderCaptureRequest` body. Returns `Order`;
errors are `Error{ name, message, details[] }` with `details[].issue` + `description`, status arms
400/401/403/404/422/500.

**Diff vs `lib/paypal.ts` `normalizeCapture`:** MATCH, no change.
We read `purchase_units[].payments.captures[].{id,status}` + order `status`; 422 issues
`INSTRUMENT_DECLINED` → `declined`, `ORDER_ALREADY_CAPTURED` → `already_captured`; capture row status
`DECLINED` → `declined`. Proven live: capture `2VE50848ML7665122` completed on order `3CB243834H9187224`.

## Q3 — Idempotency: PayPal-Request-Id on create and capture

**Answer (SDK map fields tables):** `PayPal-Request-Id` is a first-class optional header on BOTH
`createOrder` and `captureOrder` (plus `PayPal-Mock-Response`, `Prefer`, `PayPal-Client-Metadata-Id`,
`PayPal-Partner-Attribution-Id`, `PayPal-Auth-Assertion`). The SDK additionally sends `Idempotency-Key`
minted per call.

**Diff vs `lib/paypal.ts`:** MATCH, no change. We send `PayPal-Request-Id` =
`create:${promiseId}` on create and `${promiseId}:${attempt}` on capture — the capture key is the DB
`unique(promise_id, attempt)` claim, so a retry of the same attempt reuses the same key and PayPal
dedupes. Proven live: second settle returned `deduped:true` with exactly one capture row.

## Outcome

`lib/paypal.ts` verified against the APIMatic contract — **zero diffs, zero code changes**.
The optional SDK swap (step 4) was declined: the hand-written client is proven against live sandbox
and the money path is frozen-adjacent; `normalizeCapture` stays the pure mapping layer either way.
Remaining human step: claim the free APIMatic plan via the sponsor-page form (Basic tier).
