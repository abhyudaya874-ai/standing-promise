import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { conditionSnapshot, promise } from "@/db/schema";
import { Cycle, CycleError } from "@/lib/agent/orchestrator";
import { streamVerdictSource } from "@/lib/agent/trace";
import type { AgentCtx, Emit, TraceEvent } from "@/lib/agent/types";
import { capturePromise, releasePromise, resume, waitPromise, type Outcome, type SettleCtx } from "@/lib/capture";
import { getEnv } from "@/lib/env";
import { logEvent } from "@/lib/events";
import { assertPublicHttpUrl } from "@/lib/integrations/url-guard";
import { SUPPORTED_CURRENCIES, minorFromJson, parseMinor } from "@/lib/money";
import { paypal } from "@/lib/paypal";
import { encodeSse } from "@/lib/sse";
import { computeVerdict, type Condition, type Consequence, type VerdictInput } from "@/lib/verdict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MINOR = 10_000_000;

const ConditionInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("price_at_most"), query: z.string().trim().min(2).max(120), ceiling: z.string() }), // decimal string, same currency as the promise
  z.object({ kind: z.literal("page_contains"), url: z.string().url(), needle: z.string().trim().min(1).max(120) }),
]);

const CreateBody = z.object({
  op: z.literal("create"),
  title: z.string().trim().min(1).max(120),
  amount: z.string(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  windowMinutes: z.number().int().min(1).max(60 * 24 * 30),
  payerName: z.string().trim().min(1).max(80).default("anonymous"),
  payerEmail: z.string().email().optional(),
  condition: ConditionInput.default({ kind: "none" }),
});
// Human entry for the degraded path: vendors are down, a person types what they saw.
const ManualFactBody = z.object({
  op: z.literal("manual_fact"),
  promiseId: z.string().uuid(),
  priceMajor: z.string().optional(), // for price_at_most promises, e.g. "3999.00"
  inStock: z.boolean().default(true),
  text: z.string().max(4000).optional(), // for page_contains promises
});
// A Bryntum drag. Rewrites the due date of an OPEN promise and nothing else.
const RescheduleBody = z.object({ op: z.literal("reschedule"), promiseId: z.string().uuid(), windowEndsAt: z.string().datetime() });
const SettleBody = z.object({
  op: z.literal("settle"),
  promiseId: z.string().uuid(),
  attempt: z.number().int().min(1).max(5).default(1),
});
const Body = z.discriminatedUnion("op", [CreateBody, SettleBody, ManualFactBody, RescheduleBody]);

const fail = (status: number, error: string) => Response.json({ error }, { status });
const msgOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

// @invariant:one-step-per-request  validate -> compute -> persist -> capture
export async function POST(req: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "body must be JSON");
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return fail(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const b = parsed.data;
  switch (b.op) {
    case "create":
      return create(b);
    case "settle":
      return settle(b, req.signal);
    case "manual_fact":
      return manualFact(b);
    case "reschedule":
      return reschedule(b);
  }
}

// ---------------- create ----------------
async function create(b: z.infer<typeof CreateBody>): Promise<Response> {
  let amountMinor: number;
  try {
    amountMinor = parseMinor(b.amount, b.currency);
  } catch (e) {
    return fail(400, msgOf(e));
  }
  if (amountMinor < 1 || amountMinor > MAX_MINOR) return fail(400, "amount out of range");

  let condition: Condition;
  try {
    condition = toCondition(b.condition, b.currency);
  } catch (e) {
    return fail(400, msgOf(e));
  }

  const id = randomUUID();
  const order = await paypal.createOrder(
    { promiseId: id, amountMinor, currency: b.currency, returnUrl: `${getEnv().APP_URL}/p?id=${id}` },
    { signal: AbortSignal.timeout(8000) },
  );
  if (!order.ok) return fail(502, `PayPal: ${order.issue}`);

  await getDb().insert(promise).values({
    id,
    title: b.title,
    amountMinor,
    currency: b.currency,
    windowEndsAt: new Date(Date.now() + b.windowMinutes * 60_000),
    paypalOrderId: order.orderId,
    payerName: b.payerName,
    payerEmail: b.payerEmail ?? null,
    condition,
  });
  await logEvent(id, 1, "created", { amountMinor, currency: b.currency, orderId: order.orderId, condition });
  return Response.json({ promiseId: id });
}

/** Validate the condition at the boundary: SSRF check on URLs, decimal string -> integer minor units. */
function toCondition(c: z.infer<typeof ConditionInput>, currency: string): Condition {
  switch (c.kind) {
    case "none":
      return c;
    case "price_at_most": {
      const ceilingMinor = parseMinor(c.ceiling, currency);
      if (ceilingMinor < 1) throw new Error("ceiling must be positive");
      return { kind: "price_at_most", query: c.query, ceilingMinor, currency };
    }
    case "page_contains":
      return { kind: "page_contains", url: assertPublicHttpUrl(c.url), needle: c.needle };
  }
}

// ---------------- manual_fact ----------------
async function manualFact(b: z.infer<typeof ManualFactBody>): Promise<Response> {
  const [p] = await getDb().select({ condition: promise.condition, currency: promise.currency }).from(promise).where(eq(promise.id, b.promiseId)).limit(1);
  if (!p) return fail(404, "promise not found");

  let fact;
  if (p.condition.kind === "price_at_most") {
    if (!b.priceMajor) return fail(400, "priceMajor is required for a price condition");
    try {
      fact = { kind: "product" as const, priceMinor: minorFromJson(b.priceMajor, p.currency), currency: p.currency, inStock: b.inStock };
    } catch (e) {
      return fail(400, msgOf(e));
    }
  } else if (p.condition.kind === "page_contains") {
    if (!b.text) return fail(400, "text is required for a page condition");
    fact = { kind: "page" as const, text: b.text };
  } else {
    return fail(400, "this promise has no condition");
  }
  await getDb().insert(conditionSnapshot).values({ promiseId: b.promiseId, attempt: 1, source: "manual", fact });
  await logEvent(b.promiseId, 1, "manual_fact", {});
  return Response.json({ ok: true });
}

// ---------------- reschedule ----------------
async function reschedule(b: z.infer<typeof RescheduleBody>): Promise<Response> {
  const when = new Date(b.windowEndsAt);
  const updated = await getDb()
    .update(promise)
    .set({ windowEndsAt: when })
    .where(and(eq(promise.id, b.promiseId), eq(promise.state, "open"))) // only OPEN promises move
    .returning({ id: promise.id });
  if (updated.length === 0) return fail(409, "only open promises can be rescheduled");
  await logEvent(b.promiseId, 1, "rescheduled", { windowEndsAt: when.toISOString() });
  return Response.json({ ok: true });
}

// ---------------- settle (streams trace events) ----------------
function settle(b: z.infer<typeof SettleBody>, reqSignal: AbortSignal): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          closed = true; // client left; keep working, stop writing
        }
      };
      const emit: Emit = (e: TraceEvent) => send(encodeSse(e));
      const beat = setInterval(() => send(": beat\n\n"), 5000);
      try {
        await runSettle(b, reqSignal, emit);
      } catch (err) {
        emit({ kind: "error", id: "fatal", message: msgOf(err), retryable: err instanceof CycleError ? err.retryable : false });
      } finally {
        clearInterval(beat);
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

// The verdict carries its own consequence. A lookup, NOT an if/else on the verdict.
const consequences: Record<Consequence, (c: SettleCtx) => Promise<Outcome>> = {
  CAPTURE: capturePromise,
  RELEASE: releasePromise,
  WAIT: waitPromise,
};

async function runSettle(b: z.infer<typeof SettleBody>, signal: AbortSignal, emit: Emit): Promise<void> {
  const nowMs = Date.now(); // read ONCE here, passed down. Never inside computeVerdict.
  const ctx: AgentCtx = { promiseId: b.promiseId, attempt: b.attempt, nowMs, signal, emit };
  const cycle = new Cycle(ctx);

  const g = await cycle.gather(); // 1. validate + gather facts
  const sc: SettleCtx = {
    promiseId: ctx.promiseId,
    attempt: ctx.attempt,
    orderId: g.guard.orderId,
    requestId: g.guard.requestId,
    signal,
    emit,
  };

  // Re-click / second tab: return the FIRST result, write nothing new.
  if (g.guard.existingCapture !== null || g.guard.state === "released") {
    const o = await resume(sc, g.guard);
    emit({ kind: "done", id: "done", state: o.state, deduped: true });
    return;
  }

  const source = streamVerdictSource(emit); // visual only, real source of decide()
  const input: VerdictInput = { terms: g.guard.terms, fact: g.fact, world: g.world, nowMs };
  const verdict = computeVerdict(input); // 2. compute (pure)
  emit({ kind: "verdict", id: "verdict", verdict });
  await logEvent(ctx.promiseId, ctx.attempt, "verdict", { verdict, input }); // 3. persist WITH the input, so replay can recompute
  const outcome = await consequences[verdict.consequence](sc); // 4. capture / release / wait
  await source;
  await cycle.decorate(verdict, g.guard); // best-effort prose + nudge + summary
  emit({ kind: "done", id: "done", state: outcome.state, deduped: false });
}
