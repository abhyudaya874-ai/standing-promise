---
description: Pre-submission gate before the deadline (Fri 13 Nov 01:30 IST)
---

# Release check

Run in order. Any fail stops the sequence.

1. `npm run verify`: all stages passed
2. `/hardening-pass`: 12/12 or explicit, justified deferrals
3. `/judge-mode 2`: under budget with margin
4. Sandbox audit: `grep -rn "sk_live_\|api.paypal.com" lib app db components` returns nothing
5. Flags audit: every `CAP_*` that is ON in the deploy has a key; every one OFF still leaves the app usable
6. Determinism audit: `GET /api/verdict/replay?promiseId=<a settled promise>` says `identical: true`
7. Capability strip on the home page matches `docs/INTEGRATIONS.md`
8. Postman: `npx newman run postman/collection.json -e postman/environment.local.json` green; monitor green
9. Deployed on Render, `APP_URL` set to the real URL, PayPal return URL works end to end once
10. Video submitted, link live; repo accessible; `env.example` complete; no secrets in git history (`git log -p | grep -c sk_live_` is 0)
