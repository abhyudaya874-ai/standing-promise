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

  const [row] = await db.select().from(promise).where(eq(promise.id, ctx.promiseId)).limit(1);
  if (!row) throw new Error(`promise ${ctx.promiseId} not found`);
  if (!row.paypalOrderId) throw new Error("promise has no PayPal order");
  if (!Number.isInteger(row.amountMinor) || row.amountMinor <= 0) throw new Error("amountMinor is not a positive integer");

  const [cap] = await db
    .select({ status: capture.status })
    .from(capture)
    .where(and(eq(capture.promiseId, ctx.promiseId), eq(capture.attempt, ctx.attempt)))
    .limit(1);

  if (signal.aborted) throw new Error("guard aborted");

  return {
    terms: { amountMinor: row.amountMinor, currency: row.currency, windowEndsAtMs: row.windowEndsAt.getTime(), condition: row.condition },
    payer: { name: row.payerName, email: row.payerEmail },
    orderId: row.paypalOrderId,
    state: row.state as PromiseState,
    existingCapture: (cap?.status as CaptureStatus | undefined) ?? null,
    requestId: `${ctx.promiseId}:${ctx.attempt}`,
  };
}
