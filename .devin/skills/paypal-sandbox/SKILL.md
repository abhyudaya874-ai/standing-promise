---
name: paypal-sandbox
description: PayPal sandbox specifics: order lifecycle, capture, idempotency and the failure modes that matter
allowed-tools:
  - read
  - grep
  - glob
  - exec
triggers:
  - user
  - model
---

## Environment

Sandbox only: `https://api-m.sandbox.paypal.com` (hard-coded in `lib/paypal.ts`). A live host or key is a bug.
Approval page for the demo: `https://www.sandbox.paypal.com/checkoutnow?token=<orderId>` (`approveUrlFor`).

## Order lifecycle

`create` (our create op) -> `approve` (payer, in the browser) -> `capture` (our settle op). Capture is the money moment.

- `PayPal-Request-Id` is the idempotency key = `${promiseId}:${attempt}`. Same key twice returns the first result.
- Capture outcomes (`normalizeCapture`, pure and tested): `completed`, `declined` (INSTRUMENT_DECLINED or a DECLINED capture),
  `already_captured` (ORDER_ALREADY_CAPTURED: treat as success), `error`. Persist the first three; `error` becomes `capture_pending`.
- 422 on capture: read `details[0].issue`. Do not retry blindly.

## Failure modes

| Condition | Behaviour |
|---|---|
| Timeout / network / 5xx on capture | event `capture_pending`, state `capture_pending`, **never auto-retry**; a later settle polls the order once |
| `INSTRUMENT_DECLINED` | event `capture_declined`; UI offers retry as attempt+1 |
| `ORDER_ALREADY_CAPTURED` | success; reconcile |
| 401 | refresh the token once, then fail loudly |

## Use the APIMatic context plugin for PayPal calls

Before changing `lib/paypal.ts`, ask the PayPal context plugin (see `.devin/workflows/apimatic-verify-paypal.md`) for the
current Orders v2 request/response shape. Do not paste PayPal shapes from memory.

## Hard limits

- Never log the client secret. Never retry a capture with a different `PayPal-Request-Id`.
- Never build a PayPal amount from a float: `formatMajor(minor, currency)` only.
- **PayPal cannot process INR** (it ended domestic payments in India in 2021; the Orders API rejects INR). Payable currencies live in `SUPPORTED_CURRENCIES` in `lib/money.ts`. Demo in USD.
