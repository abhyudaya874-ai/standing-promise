---
trigger: always_on
description: Vendors produce snapshots, never verdicts. The adapter contract, flags, degradation, and a full worked adapter
---

# Integrations

Ten sponsors. Eight run inside the product behind a flag; two are build-time (APIMatic, Postman).
All of them sit **outside** the determinism boundary.

## The rule

A vendor may produce a **Fact** (payment), a **ConditionFact** (world), a **Widget**, a **Nudge** or a **Trace row**.
A vendor may **never** produce a Verdict. `lib/verdict.ts` imports nothing, so it cannot even reach an adapter.

## The contract (every adapter, no exceptions)

1. Lives in `lib/integrations/<vendor>.ts`. Reads config through `getEnv()`, never `process.env`.
2. Starts with `if (!isOn("<id>")) return degrade("<id> off")`.
3. Wraps its network work in `guard("<id>", async () => { ... })` so a throw becomes `{ ok:false, degraded:true, reason }`.
4. Has a timeout (`AbortSignal.timeout(n)`), because a hung vendor must not eat the cycle budget.
5. Parses vendor JSON with `zod` (`safeParse`), never trusts shape, and keeps parsing in a **pure exported function** with a unit test.
6. Converts money through `minorFromJson` / `parseMinor`. Never `price * 100`, never `toFixed`.
7. Has a flag `CAP_<ID>` in `lib/env.ts` + `env.example`, and an entry in `CAPABILITIES` with an honest "when off" note.
8. Is called ONLY from an agent in `lib/agent/agents/` or a read-only route, never from `lib/verdict.ts`, never from a component.

`scripts/check-invariants.mjs` enforces 1, 3, 6 and "no `process.env`". It fails the build.

## A complete adapter, annotated (copy this shape)

```ts
// lib/integrations/channel3.ts  (abridged)
export function parseChannel3(body: unknown): ProductFact | null { /* PURE: zod + minorFromJson, unit-tested */ }

export async function searchProduct(query: string, signal?: AbortSignal): Promise<AdapterResult<ProductFact>> {
  if (!isOn("channel3")) return degrade("channel3 off");                          // 2. flag + key
  return guard("channel3", async () => {                                          // 3. throw -> degraded
    const res = await fetch(`${BASE}/v1/search`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": getEnv().CHANNEL3_API_KEY ?? "" },   // 1. getEnv
      body: JSON.stringify({ query, limit: 5 }),
      signal: signal ?? AbortSignal.timeout(3_000),                               // 4. timeout
    });
    if (!res.ok) return degrade(`channel3 http ${res.status}`);                   // non-2xx is a degrade, not a throw
    const fact = parseChannel3(await res.json());                                 // 5. pure parser
    return fact ? { ok: true, data: fact } : degrade("channel3 no priced offer");
  });
}
```

## Snapshot discipline

The resolver writes what a vendor saw to `condition_snapshot` BEFORE the route computes the verdict
(`@invariant:snapshot-before-verdict`). The verdict event stores `{ verdict, input }`, so
`GET /api/verdict/replay?promiseId=` recomputes the identical answer without calling any vendor.

```ts
// WRONG: the verdict reads the network. A price move between two runs flips the answer.
const r = await fetch(channel3Url); return r.price < ceiling;
// RIGHT: the caller fetched, froze it, and handed the verdict a plain value.
computeVerdict({ terms, fact, world: { kind: "product", priceMinor, currency, inStock }, nowMs })
```

## Degradation ladder (what "off" means for each)

| Vendor | Primary job | When off or failing |
|---|---|---|
| Channel3 | price/stock for `price_at_most` | manual snapshot → else `unavailable` → WAIT |
| KERNEL | browser read + replay evidence | plain `fetch` (SSRF-guarded); no replay link |
| Astropods | hosted concierge agent (agent → our read-only API) | no link on the home page. NOT in the request path |
| Elastic | precedent line, ES\|QL | no precedent line |
| Zapier | email nudge (args from the tool's own schema) | in-app banner line in the trace |
| Bryntum | timeline | the dashboard / event log |
| AG Studio | dashboard + agent | the trace page |
| Render | durable sweep + hosting | settle in-request |

Acceptance test for ANY adapter, run before you open the review: set `CAP_X=0`, run the demo path, nothing throws;
set a bad key, a `degraded` row appears and the verdict is still computed.

## Security: user URLs

Any URL a user typed that we fetch server-side goes through `assertPublicHttpUrl` (blocks localhost, private ranges,
credentials, non-http(s)) at BOTH create time and fetch time, and redirects are re-validated per hop.
