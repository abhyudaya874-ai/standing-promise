---
description: Channel3 + KERNEL: make price_at_most and page_contains promises resolve through a frozen snapshot
---

# World conditions (Channel3, KERNEL)

Already in the reference code: `lib/integrations/channel3.ts`, `kernel.ts`, `url-guard.ts`, `lib/agent/agents/resolver.ts`, the `condition_snapshot` table, the Composer's condition picker.
Your job is to switch it on and prove it.

1. Keys: Channel3 key from https://trychannel3.com/developers (promo `PAYPAL-HACKATHON-2026` = 20k credits). KERNEL key from the sponsor link ($50 credits). Put them in `.env.local`; set `CAP_CHANNEL3=1`, `CAP_KERNEL=1`.
2. Probe Channel3 once from the terminal before trusting the adapter:
   ```bash
   curl -s -X POST https://api.trychannel3.com/v1/search -H "x-api-key: $CHANNEL3_API_KEY" -H "content-type: application/json" \
     -d '{"query":"running shoes","limit":2}' | head -c 600
   ```
   Compare the field names with the zod schema in `channel3.ts`. If they differ, fix the SCHEMA and the unit test, not the call site.
3. **Use USD and a product sold in USD** (PayPal cannot process INR; a product priced in another currency yields `CURRENCY_MISMATCH`, WAIT). Create a promise with a `price_at_most` condition in the UI (ceiling above the real price so it can pass). Pay in the sandbox (Approve button), then Settle.
4. Read the trace: `channel3.search` ok -> `kernel.observe` ok (replay link) -> verdict `CONDITION_MET` -> capture.
5. Set a ceiling BELOW the price: Settle -> `CONDITION_PENDING`, WAIT, state stays open. Let the window pass -> `CONDITION_UNMET`, RELEASE.
6. **Degraded demo**: `CAP_CHANNEL3=0`, Settle -> `FACT_MISSING` (WAIT). Type a price in the manual box, Settle -> uses the manual snapshot.
7. `page_contains`: use a public page you control (a GitHub raw file works). Try a private URL: it must be rejected at create time.
8. KERNEL replay: open the `evidenceUrl` from the `snapshot` event; that is the "here is the actual page" shot for the video.

Known limits to say out loud: KERNEL evidence is not an input to the verdict; the SSRF guard does not stop DNS rebinding.
