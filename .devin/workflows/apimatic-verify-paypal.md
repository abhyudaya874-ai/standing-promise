---
description: Use the APIMatic PayPal context plugin to verify (and optionally replace) lib/paypal.ts. Qualifies for the APIMatic prize
---

# APIMatic context plugin for PayPal

Build-time only; zero runtime risk. The prize asks that you USED the plugin to build the PayPal integration, so do this and keep the evidence.

1. Install the plugin for your coding agent: `npx context-plugins install paypal` (installer: https://github.com/apimatic/context-plugins-installer). It is an MCP server; if your Devin setup cannot take it via the installer, add the plugin's MCP endpoint from that README in Devin's MCP settings. No extra PayPal credentials are needed.
2. Ask the plugin, one question at a time, and record each answer in `docs/APIMATIC-LOG.md` (question, answer summary, what you changed):
   - "Orders v2 create order request body for intent CAPTURE with payment_source.paypal.experience_context"
   - "Orders v2 capture response shape and the error `details[].issue` values for a declined instrument"
   - "Idempotency: PayPal-Request-Id behaviour on create and capture"
3. Diff each answer against `lib/paypal.ts` (`createOrder`, `getOrder`, `normalizeCapture`, `captureOrder`). Fix `lib/paypal.ts` AND `lib/paypal.test.ts` together.
4. Optional upgrade: replace the hand-written `fetch` calls with `@paypal/paypal-server-sdk` (the plugin steers you to it), keeping `normalizeCapture` as the pure mapping layer and the same exported function signatures. If you do, keep `PayPal-Request-Id` = `${promiseId}:${attempt}`.
5. `npm run verify`. Commit `integration: verify paypal against apimatic context`.
6. Claim the free plan via the form on the sponsor page (Basic for participants who used it; Business for winners).
