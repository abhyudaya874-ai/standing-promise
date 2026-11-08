import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { capture, promise, type CaptureStatus, type PromiseState } from "@/db/schema";
import type { AgentCtx, GuardFacts } from "../types";

/**
 * Deterministic. Reads LOCAL state only. Fails closed (throws).
 * Everything capture needs to prove about the promise lives here so the route stays short.
 */
export async function runGuard(ctx: AgentCtx, signal: AbortSignal): Promise<GuardFacts> {
  const db = getDb();

  // ONE round trip: the capture slot for this attempt rides along on the promise row.
  // Remote DBs (Neon HTTP) make each query a ~300ms call; two queries cannot fit the cap.
  const [joined] = await db
    .select({ p: promise, capStatus: capture.status })
    .from(promise)
    .leftJoin(capture, and(eq(capture.promiseId, promise.id), eq(capture.attempt, ctx.attempt)))
    .where(eq(promise.id, ctx.promiseId))
    .limit(1);
  const row = joined?.p;
  if (!row) throw new Error(`promise ${ctx.promiseId} not found`);
  if (!row.paypalOrderId) throw new Error("promise has no PayPal order");
  if (!Number.isInteger(row.amountMinor) || row.amountMinor <= 0) throw new Error("amountMinor is not a positive integer");

  if (signal.aborted) throw new Error("guard aborted");

  return {
    terms: { amountMinor: row.amountMinor, currency: row.currency, windowEndsAtMs: row.windowEndsAt.getTime(), condition: row.condition },
    payer: { name: row.payerName, email: row.payerEmail },
    orderId: row.paypalOrderId,
    state: row.state as PromiseState,
    existingCapture: (joined?.capStatus as CaptureStatus | undefined) ?? null,
    requestId: `${ctx.promiseId}:${ctx.attempt}`,
  };
}
