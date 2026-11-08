# ANTI-PATTERNS: wrong → right. Scan before you say "done".

| # | WRONG | RIGHT | Why it matters |
|---|---|---|---|
| 1 | `const closed = Date.now() >= end` in `verdict.ts` | `const closed = input.nowMs >= terms.windowEndsAtMs` | same input must give the same verdict forever |
| 2 | `import { searchProduct } from "@/lib/integrations/channel3"` in `verdict.ts` | resolver fetches, freezes a snapshot, passes `world` | a price move would flip a past answer |
| 3 | `Math.round(offer.price * 100)` | `minorFromJson(offer.price, currency)` | floats lose cents; the checker fails the build |
| 4 | `` `${(minor / 100).toFixed(2)} USD` `` | `` `${formatMajor(minor, "USD")} USD` `` | same |
| 5 | `if (!existing) await paypal.captureOrder(...)` | claim row with `onConflictDoNothing()`, then call | check-then-act races across tabs |
| 6 | `await setState(id, "released")` alone | `await logEvent(..., "released"); await setState(...)` | the log is the source of truth |
| 7 | `if (verdict.reason === "AMOUNT_MET") capture()` in the route | `consequences[verdict.consequence](ctx)` | codes change; the consequence lives in `OUTCOME` |
| 8 | observer fails → `fact = { kind: "none" }` | `fact = { kind: "unavailable" }` | "could not see" must WAIT, never RELEASE |
| 9 | `const r = await fetch(vendor); return r.json()` | `isOn` → `guard` → timeout → zod parse | a vendor outage must degrade, not throw |
| 10 | `process.env.CHANNEL3_API_KEY` in app code | `getEnv().CHANNEL3_API_KEY` | validated once, readable crash |
| 11 | vendor key in a `NEXT_PUBLIC_*` var (except the AG Studio licence) | server route proxy (`/api/studio/llm`) | keys never reach the browser |
| 12 | `fetch(userUrl)` | `fetch(assertPublicHttpUrl(userUrl))`, redirects re-validated | SSRF into cloud metadata |
| 13 | `catch {}` that swallows then returns success | catch → `degrade(reason)` or record `capture_pending` | silent failure = wrong money state |
| 14 | `any`, `@ts-ignore`, `as never` to silence a type | read the `.d.ts`, fix the type, or `as unknown as X` WITH a comment saying why | checker bans `any`/suppressions |
| 15 | a free-text `reason: "price too high"` | a closed `ReasonCode` + `FALLBACK` sentence | prose reasons break the judge's diff |
| 16 | `GET /api/promise?settle=1` that writes | writes only via `POST /api/promise` | GET must be safe to prefetch |
| 17 | `setTimeout`/`Date.now()` driving a verdict in a component | the server computes; the client renders | |
| 18 | edit `scripts/check-invariants.mjs` to pass | fix the code the check names | the check is the contract |
| 19 | delete or `.skip` a failing test | find out why it fails; it is a finding | |
| 20 | add a new dependency "just for this" | use what is installed, or state the cost (rule 20) | demo risk + bundle |
| 21 | import `db` constant: `import { db } from "@/db"` | `getDb()` | lazy, so builds and tests need no DATABASE_URL |
| 22 | agent calls `computeVerdict` "to preview" | agent returns data; only the route computes | agents never decide |
| 23 | invent a function name from memory | grep `docs/CODEMAP.md`, then the repo | the commonest small-model failure |
| 24 | write a vendor header/field from memory | read the docs page or the `.d.ts` | Channel3 uses `x-api-key`, not Bearer; Zapier needs the MCP handshake |
| 25 | put Render Workflows in `render.yaml` | create the workflow service in the dashboard | Blueprints do not support Workflows |
| 26 | TypeScript 7 in a Next 15 project | pin `typescript@5.9.x` | Next's config loader fails on TS 7 |
| 27 | add `"INR"` to `SUPPORTED_CURRENCIES`, or demo in ₹ | USD (or EUR/GBP/CAD/AUD/JPY) | PayPal does not process INR; `check-invariants.mjs` fails the build |
| 28 | make the app call an Astropods agent over HTTP | the agent calls our read-only endpoints; the app only links to it | deployed Astropods agents are human-facing; no invoke API is documented |
| 29 | send Zapier extra arguments the tool's schema does not declare | `buildToolArgs(schemaProps, n)`: `instructions` always, the rest only if declared | strict schemas reject unknown keys |
| 30 | treat a Zapier reply with `followUpQuestion` as "sent" | `needsFollowUp(text)` → degrade | it means Zapier needs more information, nothing was sent |
