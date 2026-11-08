# BOOTSTRAP: exact setup (verified)

The reference code in `reference/` was **typechecked, unit-tested (126 tests), invariant-checked and `next build`-ed**
with exactly these versions. Do not "upgrade while you're at it" before the demo.

```bash
npx create-next-app@15 . --ts --tailwind --app --no-src-dir --import-alias "@/*" --use-npm
rm app/page.tsx                      # the pack ships its own; install-reference never overwrites
npm install --save-exact \
  next@15.5.29 react@19.3.1 react-dom@19.3.1 zod@4.6.7 drizzle-orm@0.45.4 @neondatabase/serverless@1.2.0 \
  ag-studio@3.1.0 ag-studio-react@3.1.0 \
  @bryntum/scheduler@npm:@bryntum/scheduler-trial@7.3.8 @bryntum/scheduler-react@7.3.8 \
  @onkernel/sdk@0.141.0 @modelcontextprotocol/sdk@1.32.2 @renderinc/sdk@1.7.0
npm install --save-exact --save-dev \
  typescript@5.9.3 vitest@5.1.0 drizzle-kit@0.31.11 tsx
bash scripts/install-reference.sh
cp env.example .env.local            # then fill DATABASE_URL (a Neon BRANCH) + PayPal sandbox keys
npx drizzle-kit migrate              # migration 0000_init is already in drizzle/
npm run verify
npm run dev
```

**Pin `typescript` to 5.9.x.** Next 15.5 fails to load `next.config.ts` and path aliases under TypeScript 7.

## package.json scripts (merge these in)

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit",
  "test": "vitest",
  "verify": "node scripts/verify.mjs",
  "verify:fast": "node scripts/verify.mjs --fast",
  "test:api": "npx newman run postman/collection.json -e postman/environment.local.json",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate"
}
```

## CSS for the Bryntum bars (append to `app/globals.css`)

```css
.b-sch-event.met { background-color: #10b981; }
.b-sch-event.unmet { background-color: #ef4444; }
.b-sch-event.pending { background-color: #f59e0b; }
```

## Credentials you must get from a human (never invent them)

| What | Where | Needed for |
|---|---|---|
| Neon branch URL | neon.tech | everything |
| PayPal sandbox client id/secret + a sandbox BUYER account | developer.paypal.com | create / approve / capture |
| Channel3 key | trychannel3.com/developers (promo `PAYPAL-HACKATHON-2026`) | price conditions |
| KERNEL key | sponsor credit link | replay evidence |
| AG Studio licence (optional) | AG Grid hackathon page, 45-day trial | removes the watermark |
| Zapier MCP token | zapier.com (14-day Pro trial) | nudges |
| Render API key + $50 credit | render.com | deploy + sweep |
| Elastic URL + API key | ela.st/elastic-paypal-hackathon | precedent (optional) |
| LLM key for the Studio agent | any OpenAI-compatible chat-completions provider (OpenAI, or Anthropic's OpenAI-compatible endpoint) | Studio chat (optional) |
| Astropods account | astropods.com | the concierge agent (optional; its model needs no key) |

## What was NOT verified

No vendor adapter was run against a live vendor (no keys). Each adapter was checked against the vendor's docs or the
installed package's type declarations, and its parser is unit-tested. Run each `wire-*` workflow once with real keys.
Still unverified specifically: the Studio adapter against a live Studio session, tool calling through the Astropods gateway, Render Workflows start details (public beta).
Currency: payments are USD/EUR/GBP/CAD/AUD/JPY. **PayPal does not process INR.** Use a USD product for Channel3 conditions.
