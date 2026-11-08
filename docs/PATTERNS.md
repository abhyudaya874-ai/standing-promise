# PATTERNS: copy, then adapt. Do not invent a new shape for an old problem.

Each recipe is real code from this repo. Names match `docs/CODEMAP.md`.

## 1. A table-driven test row
```ts
// lib/verdict.test.ts. Columns: reason, terms, fact, world, nowMs, kind, consequence
["CONDITION_PENDING", mk(price, "INR"), paidINR, { kind: "product", priceMinor: 400_001, currency: "INR", inStock: true }, OPEN, "indeterminate", "WAIT"],
```
Boundaries get TWO rows (`END - 1` open, `END` closed).

## 2. Money in and out
```ts
const amountMinor = parseMinor("10.50", "USD");          // 1050 (user input / decimal strings)
const fromVendor  = minorFromJson(399.99, "USD");        // 39999 (vendor JSON numbers). Throws on 1e21, NaN, 0.001
const label       = `${formatMajor(1050, "USD")} USD`;   // "10.50 USD" (display + PayPal amount strings)
```
NEVER `price * 100`, `toFixed`, `parseFloat`, `/ 100`.

## 3. A new vendor adapter (the whole shape)
```ts
export async function doThing(input: string, signal?: AbortSignal): Promise<AdapterResult<Thing>> {
  if (!isOn("channel3")) return degrade("channel3 off");
  return guard("channel3", async () => {
    const res = await fetch(URL, { method: "POST", headers: {...}, body: JSON.stringify({...}), signal: signal ?? AbortSignal.timeout(3_000) });
    if (!res.ok) return degrade(`channel3 http ${res.status}`);
    const thing = parseThing(await res.json());          // PURE function: zod safeParse, unit-tested
    return thing ? { ok: true, data: thing } : degrade("channel3 unexpected body");
  });
}
```

## 4. Calling an adapter from an agent (so it shows in the trace and logs degradation)
```ts
// lib/agent/agents/resolver.ts
const p = await attempt("channel3.search", { query }, () => searchProduct(query, signal));   // null when degraded
if (p) { world = { kind: "product", priceMinor: p.priceMinor, currency: p.currency, inStock: p.inStock }; }
```
`attempt` wraps `traced(...)`, converts `{ok:false}` into a thrown error (red row), logs a `degraded` event, returns `null`.

## 5. Claim-then-act (idempotent side effect)
```ts
const claimed = await db.insert(capture).values({ promiseId, attempt, requestId, status: "pending" })
  .onConflictDoNothing().returning({ id: capture.id });
if (claimed.length === 0) return resume(c, {...});     // someone else owns this attempt: return THEIR result
await logEvent(promiseId, attempt, "capture_started", {...});   // event BEFORE the side effect
const outcome = await paypal.captureOrder(orderId, requestId, { signal });
```

## 6. Consequence lookup (never if/else on the verdict)
```ts
const consequences: Record<Consequence, (c: SettleCtx) => Promise<Outcome>> = { CAPTURE: capturePromise, RELEASE: releasePromise, WAIT: waitPromise };
const outcome = await consequences[verdict.consequence](sc);
```

## 7. Add an op to the single write endpoint
```ts
// 1) a zod body  2) add it to the discriminated union  3) one switch case  4) one small handler that validates, writes, logs an event
const ManualFactBody = z.object({ op: z.literal("manual_fact"), promiseId: z.string().uuid(), priceMajor: z.string().optional() });
const Body = z.discriminatedUnion("op", [CreateBody, SettleBody, ManualFactBody, RescheduleBody]);
switch (b.op) { case "manual_fact": return manualFact(b); /* …*/ }
```
TypeScript errors if the switch misses a case. Add a Postman request with a test in the same commit.

## 8. A new subagent
See `.devin/workflows/add-subagent.md` (full code for a `watcher`).

## 9. A trace row for any external call
```ts
const res = await traced(ctx.emit, "paypal.getOrder", { orderId }, async () => {
  const r = await paypal.getOrder(orderId, { signal });
  if (!r.ok) throw new Error(`provider ${r.status}: ${r.issue}`);   // throw so the panel shows RED
  return r;
});
```

## 10. A failure-path test for pure parsing
```ts
it.each([{}, { products: [] }, null])("returns null for %j", (b) => expect(parseChannel3(b)).toBeNull());
```

## 11. A server component that reads the DB (protected page rules)
```tsx
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;               // Next 15: searchParams is a Promise
  const [p] = await getDb().select().from(promise).where(eq(promise.id, id)).limit(1);   // DB only: no network here
```

## 12. A client component that consumes the SSE stream
```tsx
const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
for (;;) { const { done, value } = await reader.read(); if (done) break;
  buf += dec.decode(value, { stream: true }); const { events, rest } = parseSse(buf); buf = rest; events.forEach(apply); }
// apply(e): setTrace(t => upsertEvent(t, e)); if (e.kind === "verdict") setVerdict(e.verdict); if (e.kind === "done") setState(e.state);
```

## 13. A guarded drizzle query with jsonb
```ts
reason: sql<string>`${promiseEvent.payload}->'verdict'->>'reason'`,     // Postgres jsonb path; lib/studio/rows.ts
```

## 15. Build tool arguments from the tool's own schema (MCP)
```ts
const { tools } = await client.listTools();
const tool = tools.find((t) => t.name === env.ZAPIER_NUDGE_TOOL);
if (!tool) return degrade(`tool not exposed; available: ${tools.map((t) => t.name).join(", ")}`);   // the trace row names the fix
const props = Object.keys((tool.inputSchema.properties ?? {}) as Record<string, unknown>);
await client.callTool({ name: tool.name, arguments: buildToolArgs(props, nudge) });                 // pure + tested
```

## 16. Adapt a provider's stream with a pure accumulator
`ChatStreamAccumulator` in `components/studio/chat-adapter.ts`: `push(chunk) -> events[]`, `finish() -> {events, output}`. Test it with fixture chunks, never with the network.

## 14. A Studio custom widget (data mapping + query)
See `components/studio/widgets/verdict-pill.tsx` and its definition in `registry.ts` (both the `dataMapping` AND the `form` field).
